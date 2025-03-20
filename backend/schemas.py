from typing import List, Optional
from datetime import date
from pydantic import BaseModel

# Income schemas
class IncomeBase(BaseModel):
    amount: float
    description: str
    date: date
    category: str

class IncomeCreate(IncomeBase):
    pass

class IncomeUpdate(IncomeBase):
    pass

class Income(IncomeBase):
    id: int
    user_id: int

    class Config:
        orm_mode = True

# Expense schemas
class ExpenseBase(BaseModel):
    amount: float
    description: str
    date: date
    category: str
    property_type: Optional[str] = None
    tax_deductible: Optional[bool] = None
    attachment_filename: Optional[str] = None
    attachment_path: Optional[str] = None

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseUpdate(ExpenseBase):
    pass

class Expense(ExpenseBase):
    id: int
    user_id: int

    class Config:
        orm_mode = True

# Receipt schemas
class FeedbackModel(BaseModel):
    correct_description: Optional[str] = None
    correct_amount: Optional[float] = None
    correct_date: Optional[date] = None
    correct_category: Optional[str] = None
    notes: Optional[str] = None

class ExtractedTransactionBase(BaseModel):
    description: str
    amount: float
    date: Optional[date] = None
    category: Optional[str] = None

class ExtractedTransactionCreate(ExtractedTransactionBase):
    receipt_id: int

class ExtractedTransaction(ExtractedTransactionBase):
    id: int
    verified: bool
    added_to_expenses: bool
    expense_id: Optional[int] = None
    receipt_id: int
    user_verified: Optional[bool] = False
    confidence_score: Optional[float] = 1.0
    original_text: Optional[str] = None
    correction_history: Optional[dict] = None

    class Config:
        orm_mode = True

class ReceiptBase(BaseModel):
    merchant_name: Optional[str] = None
    receipt_date: Optional[date] = None
    receipt_total: Optional[float] = None

class ReceiptCreate(ReceiptBase):
    filename: str
    file_path: str

class Receipt(ReceiptBase):
    id: int
    filename: str
    file_path: str
    processed: bool
    verified: bool
    created_at: date
    user_id: int
    status: Optional[str] = "pending"
    error_message: Optional[str] = None
    processing_time: Optional[float] = None
    progress: Optional[float] = 0.0
    feedback: Optional[dict] = None
    extracted_transactions: List[ExtractedTransaction] = []

    class Config:
        orm_mode = True

# Additional schemas for agentic workflow
class ProcessingStatus(BaseModel):
    receipt_id: int
    status: str
    progress: Optional[float] = None
    message: Optional[str] = None

class ReceiptFeedback(BaseModel):
    user_id: int
    receipt_id: int
    quality_rating: Optional[int] = None  # 1-5 star rating
    accuracy_rating: Optional[int] = None  # 1-5 star rating
    comments: Optional[str] = None

class TransactionFeedback(BaseModel):
    transaction_id: int
    feedback: FeedbackModel

class MerchantInsightRequest(BaseModel):
    merchant_name: str
    user_id: Optional[int] = None

class ProcessedReceiptResponse(BaseModel):
    status: str
    receipt_id: int
    data: Optional[dict] = None
    message: Optional[str] = None

# User schemas
class UserBase(BaseModel):
    email: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool
    incomes: List[Income] = []
    expenses: List[Expense] = []
    
    class Config:
        orm_mode = True

# Auth schemas
class TokenData(BaseModel):
    token: str 