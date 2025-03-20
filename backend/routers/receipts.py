import os
import shutil
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, BackgroundTasks
from sqlalchemy.orm import Session
import uuid
from datetime import datetime
import time

from database import get_db
from models import User
from schemas import Receipt, ExtractedTransaction, ProcessingStatus, ReceiptFeedback, TransactionFeedback, \
    MerchantInsightRequest, ProcessedReceiptResponse, FeedbackModel
import crud_receipts
from receipt_processor import ReceiptProcessor
from dependencies import get_current_user

router = APIRouter(
    prefix="/receipts",
    tags=["receipts"],
    responses={404: {"description": "Not found"}},
)

# Create upload directory if it doesn't exist
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "receipts")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Initialize the receipt processor with default config
receipt_processor = ReceiptProcessor()

# In-memory store for tracking processing status
processing_status_store = {}

@router.post("/", response_model=Receipt, status_code=status.HTTP_201_CREATED)
async def upload_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a receipt (PDF or image) and extract its information.
    
    This endpoint:
    1. Uploads the file
    2. Processes it with AI to extract information
    3. Creates a receipt record
    4. Returns the extracted information for verification
    """
    # Check file extension
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in [".pdf", ".jpg", ".jpeg", ".png"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Only PDF, JPG, JPEG, and PNG are supported."
        )
    
    # Generate unique filename to avoid collisions
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save the file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        # Process the receipt with AI
        receipt_data = await receipt_processor.process_receipt(file)
        
        # Create receipt in database
        db_receipt = await crud_receipts.create_receipt(
            db=db,
            user_id=current_user.id,
            filename=unique_filename,
            file_path=file_path,
            merchant_name=receipt_data.merchant_name,
            receipt_date=datetime.strptime(receipt_data.receipt_date, "%Y-%m-%d").date() if receipt_data.receipt_date else None,
            receipt_total=receipt_data.receipt_total
        )
        
        # Create extracted transactions
        for transaction in receipt_data.transactions:
            await crud_receipts.create_extracted_transaction(
                db=db,
                receipt_id=db_receipt.id,
                description=transaction.description,
                amount=transaction.amount,
                date=datetime.strptime(transaction.date, "%Y-%m-%d").date() if transaction.date else None,
                category=transaction.category
            )
        
        # Mark receipt as processed
        db_receipt = crud_receipts.update_receipt(
            db=db,
            receipt_id=db_receipt.id,
            user_id=current_user.id,
            processed=True
        )
        
        # Return the receipt with extracted transactions
        return db_receipt
    except Exception as e:
        # Clean up the file if processing fails
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing receipt: {str(e)}"
        )

@router.post("/async", response_model=ProcessingStatus, status_code=status.HTTP_202_ACCEPTED)
async def upload_receipt_async(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a receipt for asynchronous processing.
    
    This endpoint:
    1. Uploads and saves the file
    2. Creates a receipt record with 'processing' status
    3. Adds receipt processing to background tasks
    4. Returns a processing ID to check status later
    """
    # Check file extension
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in [".pdf", ".jpg", ".jpeg", ".png"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Only PDF, JPG, JPEG, and PNG are supported."
        )
    
    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Save the file
    try:
        # Read file content
        file_content = await file.read()
        
        # Save to disk
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
            
        # Create receipt record with processing status
        db_receipt = await crud_receipts.create_receipt(
            db=db,
            user_id=current_user.id,
            filename=unique_filename,
            file_path=file_path,
            status="processing",
            progress=0.0
        )
        
        # Set initial status in memory store
        processing_status_store[db_receipt.id] = {
            "status": "processing",
            "start_time": time.time(),
            "progress": 0.0,
            "message": "Receipt uploaded, queued for processing"
        }
        
        # Add processing task to background tasks
        background_tasks.add_task(
            receipt_processor.process_receipt_background,
            content=file_content,
            filename=file.filename,
            mime_type=file.content_type,
            db=db,
            receipt_id=db_receipt.id,
            user_id=current_user.id
        )
        
        # Return processing status
        return ProcessingStatus(
            receipt_id=db_receipt.id,
            status="processing",
            progress=0.0,
            message="Receipt uploaded and queued for processing"
        )
        
    except Exception as e:
        # Clean up any saved file on error
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=500,
            detail=f"Error starting receipt processing: {str(e)}"
        )

@router.get("/status/{receipt_id}", response_model=ProcessingStatus)
async def get_processing_status(
    receipt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the status of an asynchronously processing receipt.
    """
    # First check the receipt exists and belongs to current user
    receipt = crud_receipts.get_receipt(db, receipt_id=receipt_id, user_id=current_user.id)
    if not receipt:
        raise HTTPException(
            status_code=404,
            detail="Receipt not found"
        )
    
    # Get status from memory store or database
    status_info = processing_status_store.get(receipt_id, None)
    
    # If not in memory, get from database
    if not status_info:
        return ProcessingStatus(
            receipt_id=receipt_id,
            status=receipt.status or "unknown",
            progress=receipt.progress or 1.0 if receipt.processed else 0.0,
            message=receipt.error_message or f"Processing {receipt.status}"
        )
    
    # Return current status
    return ProcessingStatus(
        receipt_id=receipt_id,
        status=status_info.get("status", "unknown"),
        progress=status_info.get("progress", 0.0),
        message=status_info.get("message", "Status unknown")
    )

@router.post("/feedback/{receipt_id}", response_model=Dict[str, Any])
async def submit_receipt_feedback(
    receipt_id: int,
    feedback: ReceiptFeedback,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submit feedback on the overall receipt processing quality.
    """
    # Verify receipt exists and belongs to user
    receipt = crud_receipts.get_receipt(db, receipt_id=receipt_id, user_id=current_user.id)
    if not receipt:
        raise HTTPException(
            status_code=404,
            detail="Receipt not found"
        )
    
    # Update receipt with feedback
    try:
        crud_receipts.update_receipt(
            db=db,
            receipt_id=receipt_id,
            user_id=current_user.id,
            feedback=feedback.dict()
        )
        
        return {"status": "success", "message": "Feedback recorded"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error recording feedback: {str(e)}"
        )

@router.post("/transaction/{transaction_id}/feedback", response_model=Dict[str, Any])
async def submit_transaction_feedback(
    transaction_id: int,
    feedback: TransactionFeedback,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submit feedback for a specific transaction to improve future processing.
    """
    # Verify transaction exists and belongs to user
    transaction = crud_receipts.get_transaction(db, transaction_id=transaction_id)
    if not transaction:
        raise HTTPException(
            status_code=404,
            detail="Transaction not found"
        )
    
    # Verify receipt belongs to user
    receipt = crud_receipts.get_receipt(db, receipt_id=transaction.receipt_id, user_id=current_user.id)
    if not receipt:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to provide feedback on this transaction"
        )
    
    # Process feedback and update AI model
    try:
        result = await receipt_processor.record_user_feedback(
            receipt_id=transaction.receipt_id,
            transaction_id=transaction_id,
            feedback=feedback.feedback.dict(),
            db=db,
            user_id=current_user.id
        )
        
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing feedback: {str(e)}"
        )

@router.post("/merchant/insights", response_model=Dict[str, Any])
async def get_merchant_insights(
    request: MerchantInsightRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Get insights about a specific merchant based on transaction history.
    """
    try:
        insights = receipt_processor.get_merchant_insights(
            merchant_name=request.merchant_name,
            user_id=current_user.id
        )
        
        return insights
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating merchant insights: {str(e)}"
        )

@router.get("/", response_model=List[Receipt])
async def get_receipts(
    skip: int = 0, 
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all receipts for the current user."""
    return crud_receipts.get_receipts(db=db, user_id=current_user.id, skip=skip, limit=limit)

@router.get("/{receipt_id}", response_model=Receipt)
async def get_receipt(
    receipt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific receipt by ID."""
    db_receipt = crud_receipts.get_receipt(db=db, receipt_id=receipt_id, user_id=current_user.id)
    if db_receipt is None:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return db_receipt

@router.put("/{receipt_id}", response_model=Receipt)
async def update_receipt(
    receipt_id: int,
    merchant_name: Optional[str] = Form(None),
    receipt_date: Optional[str] = Form(None),
    receipt_total: Optional[float] = Form(None),
    verified: Optional[bool] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update receipt information after verification."""
    update_data = {}
    if merchant_name is not None:
        update_data["merchant_name"] = merchant_name
    if receipt_date is not None:
        update_data["receipt_date"] = datetime.strptime(receipt_date, "%Y-%m-%d").date()
    if receipt_total is not None:
        update_data["receipt_total"] = receipt_total
    if verified is not None:
        update_data["verified"] = verified
    
    db_receipt = crud_receipts.update_receipt(
        db=db, 
        receipt_id=receipt_id, 
        user_id=current_user.id,
        **update_data
    )
    
    if db_receipt is None:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return db_receipt

@router.delete("/{receipt_id}")
async def delete_receipt(
    receipt_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a receipt and its associated transactions."""
    success = crud_receipts.delete_receipt(db=db, receipt_id=receipt_id, user_id=current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return {"detail": "Receipt deleted successfully"}

@router.put("/transactions/{transaction_id}", response_model=ExtractedTransaction)
async def update_transaction(
    transaction_id: int,
    description: Optional[str] = Form(None),
    amount: Optional[float] = Form(None),
    date: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    verified: Optional[bool] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an extracted transaction."""
    update_data = {}
    if description is not None:
        update_data["description"] = description
    if amount is not None:
        update_data["amount"] = amount
    if date is not None:
        update_data["date"] = datetime.strptime(date, "%Y-%m-%d").date()
    if category is not None:
        update_data["category"] = category
    if verified is not None:
        update_data["verified"] = verified
    
    db_transaction = crud_receipts.update_extracted_transaction(
        db=db,
        transaction_id=transaction_id,
        **update_data
    )
    
    if db_transaction is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return db_transaction

@router.post("/transactions/{transaction_id}/add-to-expenses")
async def add_transaction_to_expenses(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a verified transaction to expenses."""
    expense = crud_receipts.add_transaction_to_expenses(
        db=db,
        transaction_id=transaction_id,
        user_id=current_user.id
    )
    
    if expense is None:
        raise HTTPException(
            status_code=400,
            detail="Could not add transaction to expenses. Make sure the transaction exists, belongs to you, and hasn't already been added."
        )
    
    return {"detail": "Transaction added to expenses", "expense_id": expense.id}
