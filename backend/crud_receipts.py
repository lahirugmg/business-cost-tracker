from typing import List, Optional, Dict, Any
import os
from datetime import date, datetime
from sqlalchemy.orm import Session
import json

from models import Receipt, ExtractedTransaction, Expense
import schemas

async def create_receipt(
    db: Session, 
    user_id: int, 
    filename: str, 
    file_path: str,
    merchant_name: Optional[str] = None,
    receipt_date: Optional[date] = None,
    receipt_total: Optional[float] = None,
    status: Optional[str] = "pending",
    progress: Optional[float] = 0.0,
    error_message: Optional[str] = None
) -> Receipt:
    """Create a new receipt record in the database."""
    db_receipt = Receipt(
        filename=filename,
        file_path=file_path,
        merchant_name=merchant_name,
        receipt_date=receipt_date,
        receipt_total=receipt_total,
        processed=False,
        verified=False,
        user_id=user_id,
        status=status,
        progress=progress,
        error_message=error_message
    )
    db.add(db_receipt)
    db.commit()
    db.refresh(db_receipt)
    return db_receipt

def get_receipts(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[Receipt]:
    """Get all receipts for a user."""
    return db.query(Receipt).filter(Receipt.user_id == user_id).offset(skip).limit(limit).all()

def get_receipt(db: Session, receipt_id: int, user_id: int) -> Optional[Receipt]:
    """Get a specific receipt by ID for a user."""
    return db.query(Receipt).filter(Receipt.id == receipt_id, Receipt.user_id == user_id).first()

def update_receipt(
    db: Session, 
    receipt_id: int, 
    user_id: int, 
    **kwargs
) -> Optional[Receipt]:
    """Update a receipt's details."""
    db_receipt = get_receipt(db, receipt_id, user_id)
    if db_receipt:
        for key, value in kwargs.items():
            setattr(db_receipt, key, value)
        db.commit()
        db.refresh(db_receipt)
    return db_receipt

def delete_receipt(db: Session, receipt_id: int, user_id: int) -> bool:
    """Delete a receipt and its associated extracted transactions."""
    db_receipt = get_receipt(db, receipt_id, user_id)
    if db_receipt:
        # Delete associated extracted transactions
        db.query(ExtractedTransaction).filter(
            ExtractedTransaction.receipt_id == receipt_id
        ).delete()
        
        # Delete receipt file if it exists
        if os.path.exists(db_receipt.file_path):
            os.remove(db_receipt.file_path)
            
        # Delete receipt from database
        db.delete(db_receipt)
        db.commit()
        return True
    return False

async def create_extracted_transaction(
    db: Session,
    receipt_id: int,
    description: str,
    amount: float,
    date: Optional[date] = None,
    category: Optional[str] = None,
    original_text: Optional[str] = None,
    confidence_score: Optional[float] = 1.0
) -> ExtractedTransaction:
    """Create a new extracted transaction from a receipt."""
    db_transaction = ExtractedTransaction(
        description=description,
        amount=amount,
        date=date or datetime.now().date(),
        category=category or "Miscellaneous",
        verified=False,
        user_verified=False,
        added_to_expenses=False,
        receipt_id=receipt_id,
        original_text=original_text,
        confidence_score=confidence_score
    )
    db.add(db_transaction)
    db.commit()
    db.refresh(db_transaction)
    return db_transaction

def get_extracted_transactions(db: Session, receipt_id: int) -> List[ExtractedTransaction]:
    """Get all extracted transactions for a receipt."""
    return db.query(ExtractedTransaction).filter(
        ExtractedTransaction.receipt_id == receipt_id
    ).all()

def update_extracted_transaction(
    db: Session, 
    transaction_id: int, 
    **kwargs
) -> Optional[ExtractedTransaction]:
    """Update an extracted transaction's details."""
    db_transaction = db.query(ExtractedTransaction).filter(
        ExtractedTransaction.id == transaction_id
    ).first()
    
    if db_transaction:
        for key, value in kwargs.items():
            setattr(db_transaction, key, value)
        db.commit()
        db.refresh(db_transaction)
    return db_transaction

def verify_transaction(db: Session, transaction_id: int) -> Optional[ExtractedTransaction]:
    """Verify an extracted transaction."""
    return update_extracted_transaction(db, transaction_id, verified=True)

def add_transaction_to_expenses(
    db: Session, 
    transaction_id: int, 
    user_id: int
) -> Optional[Expense]:
    """Add a verified transaction to expenses."""
    db_transaction = db.query(ExtractedTransaction).filter(
        ExtractedTransaction.id == transaction_id
    ).first()
    
    if not db_transaction or db_transaction.added_to_expenses:
        return None
        
    # Get the receipt to ensure it belongs to the user
    db_receipt = db.query(Receipt).filter(
        Receipt.id == db_transaction.receipt_id,
        Receipt.user_id == user_id
    ).first()
    
    if not db_receipt:
        return None
        
    # Create expense from transaction
    db_expense = Expense(
        amount=db_transaction.amount,
        description=db_transaction.description,
        date=db_transaction.date,
        category=db_transaction.category,
        attachment_filename=db_receipt.filename,
        attachment_path=db_receipt.file_path,
        user_id=user_id
    )
    
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    
    # Update transaction to mark it as added to expenses
    db_transaction.added_to_expenses = True
    db_transaction.expense_id = db_expense.id
    db.commit()
    
    return db_expense

def get_transaction(db: Session, transaction_id: int) -> Optional[ExtractedTransaction]:
    """Get a specific transaction by ID."""
    return db.query(ExtractedTransaction).filter(ExtractedTransaction.id == transaction_id).first()

def update_receipt_status(db: Session, receipt_id: int, status: str, progress: float = None, error_message: str = None) -> Optional[Receipt]:
    """Update a receipt's processing status."""
    db_receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
    if db_receipt:
        db_receipt.status = status
        
        if progress is not None:
            db_receipt.progress = progress
            
        if error_message is not None:
            db_receipt.error_message = error_message
            
        if status == "completed":
            db_receipt.processed = True
            db_receipt.processing_time = datetime.now().timestamp() - db_receipt.created_at.timestamp()
            
        db.commit()
        db.refresh(db_receipt)
    return db_receipt

def record_feedback(db: Session, receipt_id: int, user_id: int, feedback_data: Dict[str, Any]) -> Optional[Receipt]:
    """Record user feedback on receipt processing quality."""
    db_receipt = get_receipt(db, receipt_id, user_id)
    if db_receipt:
        # If feedback already exists, update it rather than replacing
        current_feedback = db_receipt.feedback or {}
        if isinstance(current_feedback, str):
            try:
                current_feedback = json.loads(current_feedback)
            except:
                current_feedback = {}
        
        # Merge new feedback with existing feedback
        current_feedback.update(feedback_data)
        
        # Update the receipt
        db_receipt.feedback = current_feedback
        db.commit()
        db.refresh(db_receipt)
    
    return db_receipt

def update_transaction_with_feedback(db: Session, transaction_id: int, feedback: Dict[str, Any]) -> Optional[ExtractedTransaction]:
    """Update transaction based on user feedback."""
    transaction = get_transaction(db, transaction_id)
    if transaction:
        # Record correction history
        history = transaction.correction_history or {}
        if isinstance(history, str):
            try:
                history = json.loads(history)
            except:
                history = {}
        
        timestamp = datetime.now().isoformat()
        history[timestamp] = {
            "previous": {
                "description": transaction.description,
                "amount": transaction.amount,
                "date": transaction.date.isoformat() if transaction.date else None,
                "category": transaction.category
            },
            "corrections": feedback
        }
        
        # Update the transaction
        if "correct_description" in feedback and feedback["correct_description"]:
            transaction.description = feedback["correct_description"]
            
        if "correct_amount" in feedback and feedback["correct_amount"]:
            transaction.amount = feedback["correct_amount"]
            
        if "correct_date" in feedback and feedback["correct_date"]:
            if isinstance(feedback["correct_date"], str):
                transaction.date = datetime.strptime(feedback["correct_date"], "%Y-%m-%d").date()
            else:
                transaction.date = feedback["correct_date"]
                
        if "correct_category" in feedback and feedback["correct_category"]:
            transaction.category = feedback["correct_category"]
        
        # Mark as user verified
        transaction.user_verified = True
        transaction.verified = True
        transaction.correction_history = history
        
        db.commit()
        db.refresh(transaction)
    
    return transaction
