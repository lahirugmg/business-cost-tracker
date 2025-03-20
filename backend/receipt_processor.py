import os
import io
import tempfile
import json
from typing import List, Dict, Any, Optional, Tuple, Callable
from datetime import datetime
from functools import lru_cache
import asyncio
import logging

# Try importing required libraries, but don't fail if they're not available
has_required_libraries = True
try:
    import magic
    import pytesseract
    from PIL import Image
    import pdfplumber
    from pdf2image import convert_from_bytes
except ImportError as e:
    has_required_libraries = False
    print(f"Warning: Some receipt processing libraries not available: {e}")
    print("Receipt processing features will be limited to demo mode")

from fastapi import UploadFile, BackgroundTasks
from sqlalchemy.orm import Session

from langchain.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.pydantic_v1 import BaseModel, Field, validator
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain.tools import tool
from langchain.chains import LLMChain
from langchain.memory import ConversationBufferMemory

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define the pydantic models for the extracted transactions
class Transaction(BaseModel):
    description: str = Field(description="Description of the transaction")
    amount: float = Field(description="Amount of the transaction in dollars")
    date: Optional[str] = Field(description="Date of the transaction in YYYY-MM-DD format if available")
    category: Optional[str] = Field(description="Category of the transaction (e.g., Food, Travel, Office Supplies)")
    
    @validator("date", pre=True, always=True)
    def validate_date(cls, v):
        if not v:
            return datetime.now().strftime("%Y-%m-%d")
        return v
    
    @validator("category", pre=True, always=True)
    def validate_category(cls, v):
        if not v:
            return "Miscellaneous"
        return v

class ReceiptData(BaseModel):
    merchant_name: Optional[str] = Field(description="Name of the merchant or vendor")
    receipt_date: Optional[str] = Field(description="Date of the receipt in YYYY-MM-DD format")
    receipt_total: Optional[float] = Field(description="Total amount on the receipt")
    transactions: List[Transaction] = Field(description="List of transactions found in the receipt")

# In-memory cache for past processing results to learn from
processing_history = {}

# Feedback data store
user_feedback_store = {}

class ReceiptProcessor:
    def __init__(self, openai_api_key: Optional[str] = None, model_name: Optional[str] = None):
        self.openai_api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
        self.model_name = model_name or os.getenv("OPENAI_MODEL", "gpt-4-turbo-preview")
        
        if not self.openai_api_key:
            raise ValueError("OpenAI API Key is required for receipt processing")
            
        # Initialize LangChain components with retry logic
        self.llm = ChatOpenAI(
            model_name=self.model_name,
            temperature=0,
            api_key=self.openai_api_key,
            request_timeout=60,
            max_retries=3
        )
        
        # Define the JSON output parser
        self.parser = JsonOutputParser(pydantic_model=ReceiptData)
        
        # Create conversation memory for learning
        self.memory = ConversationBufferMemory(memory_key="chat_history")
        
        # Background tasks queue
        self.processing_queue = []
        
        # Load categorization patterns based on past user behavior
        self.category_patterns = self._load_category_patterns()
        
    def _load_category_patterns(self) -> Dict[str, List[str]]:
        """Load learned categorization patterns from storage or use defaults"""
        try:
            # Try to load from a file if it exists
            if os.path.exists('category_patterns.json'):
                with open('category_patterns.json', 'r') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Error loading category patterns: {e}")
            
        # Default patterns
        return {
            "Food": ["restaurant", "café", "grocery", "meal", "lunch", "dinner", "breakfast"],
            "Travel": ["airline", "flight", "taxi", "uber", "lyft", "train", "bus", "rental car"],
            "Office Supplies": ["paper", "pen", "ink", "toner", "stapler", "office"],
            "Accommodation": ["hotel", "motel", "airbnb", "lodging", "inn"],
            "Utilities": ["electric", "water", "gas", "internet", "phone", "mobile"],
            "Entertainment": ["movie", "theatre", "concert", "show", "game"],
        }
    
    async def process_receipt(self, file: UploadFile, background_tasks: BackgroundTasks = None, 
                             user_id: int = None, db: Session = None, receipt_id: int = None) -> Dict:
        """Process a receipt file and queue for background processing if needed"""
        # Generate a tracking ID if receipt_id not provided
        tracking_id = receipt_id or hash(f"{file.filename}_{datetime.now().isoformat()}")
        
        try:
            # Read file content
            content = await file.read()
            
            # Initial response to user
            response = {
                "status": "processing",
                "receipt_id": tracking_id,
                "message": "Receipt uploaded and queued for processing"
            }
            
            # If background_tasks provided, process asynchronously
            if background_tasks:
                # Update receipt status to 'processing' in DB
                if db and receipt_id:
                    self._update_receipt_status(db, receipt_id, "processing")
                    
                # Add to background tasks
                background_tasks.add_task(
                    self._background_process_receipt,
                    content,
                    file.filename,
                    mime_type=magic.from_buffer(content, mime=True),
                    user_id=user_id,
                    db=db,
                    receipt_id=tracking_id
                )
            else:
                # Process immediately
                mime_type = magic.from_buffer(content, mime=True)
                receipt_data = await self._process_receipt_content(content, mime_type)
                response = {
                    "status": "completed",
                    "receipt_id": tracking_id,
                    "data": receipt_data.dict()
                }
                
            # Reset file position
            await file.seek(0)
            
            return response
            
        except Exception as e:
            logger.error(f"Error in process_receipt: {str(e)}")
            return {
                "status": "error",
                "receipt_id": tracking_id,
                "message": f"Error processing receipt: {str(e)}"
            }
    
    async def _process_receipt_content(self, content: bytes, mime_type: str) -> ReceiptData:
        """Process receipt content synchronously"""
        # Extract text based on file type
        if "pdf" in mime_type:
            extracted_text = self._extract_text_from_pdf(content)
        elif "image" in mime_type:
            extracted_text = self._extract_text_from_image(content)
        else:
            raise ValueError(f"Unsupported file type: {mime_type}. Please upload a PDF or image file.")
            
        # Parse the extracted text using LLM
        receipt_data = await self._parse_receipt_text(extracted_text)
        
        return receipt_data
        
    async def _background_process_receipt(self, content: bytes, filename: str, mime_type: str, 
                                         user_id: int = None, db: Session = None, receipt_id: int = None):
        """Process a receipt in the background"""
        try:
            # Log start of processing
            logger.info(f"Started background processing of receipt {filename} (ID: {receipt_id})")
            
            # Process the receipt
            receipt_data = await self._process_receipt_content(content, mime_type)
            
            # Store the processing results
            if user_id:
                processing_history[f"{user_id}_{receipt_id}"] = receipt_data.dict()
            
            # Update the database if provided
            if db and receipt_id:
                self._update_receipt_with_data(db, receipt_id, receipt_data)
                self._update_receipt_status(db, receipt_id, "completed")
                
            logger.info(f"Completed background processing of receipt {filename} (ID: {receipt_id})")
            
            # Return the processing results
            return receipt_data
            
        except Exception as e:
            logger.error(f"Error in background receipt processing: {str(e)}")
            
            # Update status to error if DB connection available
            if db and receipt_id:
                self._update_receipt_status(db, receipt_id, "error", error_message=str(e))
                
            # Re-raise the exception
            raise
    
    def _extract_text_from_pdf(self, content: bytes) -> str:
        """Extract text from a PDF file using pdfplumber and OCR if needed."""
        text = ""
        
        # First try with pdfplumber
        with io.BytesIO(content) as pdf_file:
            with pdfplumber.open(pdf_file) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text() or ""
                    text += page_text + "\n"
        
        # If no text was extracted, try OCR
        if not text.strip():
            text = self._ocr_pdf(content)
            
        return text
    
    def _ocr_pdf(self, content: bytes) -> str:
        """Use OCR to extract text from a PDF by converting it to images first."""
        text = ""
        
        # Convert PDF to images
        with tempfile.TemporaryDirectory() as path:
            images = convert_from_bytes(content, output_folder=path)
            
            # Perform OCR on each image
            for image in images:
                text += pytesseract.image_to_string(image) + "\n"
                
        return text
    
    def _extract_text_from_image(self, content: bytes) -> str:
        """Extract text from an image using pytesseract OCR."""
        with io.BytesIO(content) as image_file:
            image = Image.open(image_file)
            text = pytesseract.image_to_string(image)
            
        return text
        
    def _enhance_results(self, receipt_data: ReceiptData) -> ReceiptData:
        """Apply agentic enhancements to the parsed receipt data"""
        # Fix missing dates using receipt date if available
        if receipt_data.receipt_date:
            for transaction in receipt_data.transactions:
                if not transaction.date or transaction.date == "null":
                    transaction.date = receipt_data.receipt_date
        
        # Apply intelligent categorization based on merchant and description
        for transaction in receipt_data.transactions:
            if not transaction.category or transaction.category == "Miscellaneous":
                suggested_category = self._suggest_category(transaction.description, receipt_data.merchant_name)
                if suggested_category:
                    transaction.category = suggested_category
        
        # Validate total matches sum of transactions
        self._validate_receipt_total(receipt_data)
        
        return receipt_data
    
    def _suggest_category(self, description: str, merchant_name: Optional[str]) -> Optional[str]:
        """Use learned patterns to suggest a category for a transaction"""
        text_to_check = (description + " " + (merchant_name or "")).lower()
        
        # Check each category's patterns
        for category, patterns in self.category_patterns.items():
            for pattern in patterns:
                if pattern.lower() in text_to_check:
                    return category
        
        return None
    
    def _validate_receipt_total(self, receipt_data: ReceiptData) -> None:
        """Validate that transaction amounts sum to approximately the receipt total"""
        if not receipt_data.receipt_total:
            # If no total provided, estimate it from transactions
            total = sum(t.amount for t in receipt_data.transactions)
            receipt_data.receipt_total = total
            return
            
        # Calculate sum of transaction amounts
        transaction_sum = sum(t.amount for t in receipt_data.transactions)
        
        # Check if total matches within a small tolerance (e.g., 1%)
        tolerance = receipt_data.receipt_total * 0.01
        if abs(transaction_sum - receipt_data.receipt_total) > tolerance:
            # Log the discrepancy but don't change the data
            logger.warning(f"Receipt total ({receipt_data.receipt_total}) doesn't match "
                          f"transaction sum ({transaction_sum})")
    
    async def record_user_feedback(self, receipt_id: int, transaction_id: int, feedback: Dict[str, Any], 
                                db: Session = None, user_id: int = None) -> Dict[str, Any]:
        """Record user feedback to improve future processing"""
        feedback_id = f"{user_id}_{receipt_id}_{transaction_id}"
        user_feedback_store[feedback_id] = feedback
        
        # Update category patterns based on feedback
        if "correct_category" in feedback and feedback["correct_category"]:
            original_description = feedback.get("description", "")
            if original_description:
                self._update_category_patterns(original_description, feedback["correct_category"])
        
        # Update database if provided
        if db and transaction_id:
            self._update_transaction_with_feedback(db, transaction_id, feedback)
        
        return {"status": "success", "message": "Feedback recorded successfully"}
    
    def _update_category_patterns(self, description: str, category: str) -> None:
        """Update category patterns based on user feedback"""
        words = [w.lower() for w in description.split() if len(w) > 3]
        
        # Add the most distinctive words to the pattern list for this category
        if category in self.category_patterns:
            # Add up to 2 new distinctive words
            for word in words[:2]:
                if word not in self.category_patterns[category]:
                    self.category_patterns[category].append(word)
        else:
            # Create new category
            self.category_patterns[category] = words[:3]  # Use first 3 words
        
        # Save updated patterns
        try:
            with open('category_patterns.json', 'w') as f:
                json.dump(self.category_patterns, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving category patterns: {str(e)}")
    
    def _update_transaction_with_feedback(self, db: Session, transaction_id: int, feedback: Dict[str, Any]) -> None:
        """Update transaction in database with user feedback"""
        try:
            from models import ExtractedTransaction
            
            transaction = db.query(ExtractedTransaction).filter(ExtractedTransaction.id == transaction_id).first()
            if not transaction:
                logger.error(f"Transaction not found with ID: {transaction_id}")
                return
            
            # Update fields based on feedback
            if "correct_description" in feedback:
                transaction.description = feedback["correct_description"]
            if "correct_amount" in feedback:
                transaction.amount = feedback["correct_amount"]
            if "correct_date" in feedback:
                transaction.date = datetime.strptime(feedback["correct_date"], "%Y-%m-%d").date()
            if "correct_category" in feedback:
                transaction.category = feedback["correct_category"]
            
            # Mark as verified/corrected
            transaction.user_verified = True
            
            db.commit()
            
        except Exception as e:
            logger.error(f"Error updating transaction with feedback: {str(e)}")
            db.rollback()
    
    @lru_cache(maxsize=100)
    def get_merchant_insights(self, merchant_name: str, user_id: int = None) -> Dict[str, Any]:
        """Get insights about a merchant based on previous receipts"""
        # This would typically query a database, but for now we'll use our in-memory store
        receipts_for_merchant = []
        
        # Look through processing history
        for key, data in processing_history.items():
            if data.get("merchant_name") == merchant_name:
                receipts_for_merchant.append(data)
        
        if not receipts_for_merchant:
            return {"message": "No previous receipts found for this merchant"}
        
        # Calculate average spend
        totals = [r.get("receipt_total") for r in receipts_for_merchant if r.get("receipt_total")]
        avg_total = sum(totals) / len(totals) if totals else 0
        
        # Find common categories
        categories = {}
        for receipt in receipts_for_merchant:
            for tx in receipt.get("transactions", []):
                category = tx.get("category")
                if category:
                    categories[category] = categories.get(category, 0) + 1
        
        top_categories = sorted(categories.items(), key=lambda x: x[1], reverse=True)[:3]
        
        return {
            "merchant_name": merchant_name,
            "receipt_count": len(receipts_for_merchant),
            "average_spend": avg_total,
            "top_categories": [cat for cat, count in top_categories]
        }
    
    def _update_receipt_status(self, db: Session, receipt_id: int, status: str, error_message: str = None):
        """Update the receipt status in the database"""
        try:
            from models import Receipt
            receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
            if receipt:
                receipt.status = status
                if error_message:
                    receipt.error_message = error_message
                db.commit()
        except Exception as e:
            logger.error(f"Error updating receipt status: {str(e)}")
            db.rollback()
    
    def _update_receipt_with_data(self, db: Session, receipt_id: int, receipt_data: ReceiptData):
        """Update receipt and create extracted transactions in the database"""
        try:
            from models import Receipt, ExtractedTransaction
            from datetime import datetime
            
            # Get the receipt
            receipt = db.query(Receipt).filter(Receipt.id == receipt_id).first()
            if not receipt:
                logger.error(f"Receipt not found with ID: {receipt_id}")
                return
                
            # Update receipt with extracted data
            if receipt_data.merchant_name:
                receipt.merchant_name = receipt_data.merchant_name
            if receipt_data.receipt_date:
                try:
                    receipt.receipt_date = datetime.strptime(receipt_data.receipt_date, "%Y-%m-%d").date()
                except:
                    pass
            if receipt_data.receipt_total:
                receipt.receipt_total = receipt_data.receipt_total
                
            receipt.processed = True
            db.commit()
            
            # Create extracted transactions
            for transaction in receipt_data.transactions:
                extracted_transaction = ExtractedTransaction(
                    receipt_id=receipt_id,
                    description=transaction.description,
                    amount=transaction.amount,
                    date=datetime.strptime(transaction.date, "%Y-%m-%d").date() if transaction.date else None,
                    category=transaction.category
                )
                db.add(extracted_transaction)
                
            db.commit()
            
        except Exception as e:
            logger.error(f"Error updating receipt with data: {str(e)}")
            db.rollback()
    
    async def _parse_receipt_text(self, text: str) -> ReceiptData:
        """Parse receipt text using LangChain and GPT-4 with agentic capabilities"""
        # Build a richer prompt that incorporates learning from user patterns
        prompt = ChatPromptTemplate.from_template("""
        You are an intelligent agentic AI assistant specialized in extracting and analyzing information from receipts.
        
        Analyze this receipt text carefully and extract the following information:
        1. Merchant name: Look for business names, logos, headers, or footers that identify the store or service provider.
        2. Receipt date: Check for purchase dates or transaction dates in various formats and convert to YYYY-MM-DD format.
        3. Receipt total amount: Look for 'total', 'grand total', 'amount paid', or the largest amount at the bottom.
        4. List of transactions/items: Extract individual items, their descriptions, and their prices.
        
        If there are multiple items on the receipt, list each as a separate transaction.
        Use your judgment to resolve ambiguities and apply domain knowledge to make intelligent decisions.
        
        When determining categories, think about the type of merchant and the items purchased to assign appropriate categories.
        Learn from these patterns for categorization:
        {category_patterns}
        
        Receipt text:
        {receipt_text}
        
        Provide your answer in the following JSON format:
        {{
            "merchant_name": "string or null",
            "receipt_date": "YYYY-MM-DD or null",
            "receipt_total": number or null,
            "transactions": [
                {{
                    "description": "Item description",
                    "amount": number,
                    "date": "YYYY-MM-DD or null",
                    "category": "Category name"
                }},
                ...
            ]
        }}
        """)
        
        # Create the chain with memory
        category_patterns_str = json.dumps(self.category_patterns, indent=2)
        chain = prompt | self.llm | self.parser
        
        # Track start time for performance monitoring
        start_time = datetime.now()
        
        # Run the chain with retry logic
        max_retries = 3
        for attempt in range(max_retries):
            try:
                result = await chain.ainvoke({
                    "receipt_text": text,
                    "category_patterns": category_patterns_str
                })
                
                # Enhance with agentic post-processing
                enhanced_result = self._enhance_results(result)
                
                # Log successful processing time
                processing_time = (datetime.now() - start_time).total_seconds()
                logger.info(f"Successfully parsed receipt in {processing_time:.2f} seconds")
                
                return enhanced_result
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Attempt {attempt+1} failed, retrying: {str(e)}")
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                else:
                    logger.error(f"All {max_retries} parsing attempts failed: {str(e)}")
                    # Return a basic structure with error information
                    return ReceiptData(
                        merchant_name=None,
                        receipt_date=datetime.now().strftime("%Y-%m-%d"),
                        receipt_total=None,
                        transactions=[
                            Transaction(
                                description=f"Receipt parsing failed: {str(e)[:50]}...",
                                amount=0.0,
                                date=datetime.now().strftime("%Y-%m-%d"),
                                category="Miscellaneous"
                            )
                        ]
                    )
