from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, Date, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    google_id = Column(String, unique=True)
    name = Column(String)
    picture = Column(String, nullable=True)

    incomes = relationship("Income", back_populates="owner")
    expenses = relationship("Expense", back_populates="owner")
    receipts = relationship("Receipt", back_populates="owner")

class Income(Base):
    __tablename__ = "incomes"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float)
    description = Column(String)
    date = Column(Date)
    category = Column(String)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="incomes")

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float)
    description = Column(String)
    date = Column(Date)
    category = Column(String)
    property_type = Column(String, nullable=True)
    tax_deductible = Column(Boolean, default=False)
    attachment_filename = Column(String, nullable=True)
    attachment_path = Column(String, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="expenses")

class Receipt(Base):
    __tablename__ = "receipts"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)
    file_path = Column(String)
    merchant_name = Column(String, nullable=True)
    receipt_date = Column(Date, nullable=True)
    receipt_total = Column(Float, nullable=True)
    processed = Column(Boolean, default=False)
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
    user_id = Column(Integer, ForeignKey("users.id"))
    # Fields for agentic workflow
    status = Column(String, default="pending")  # pending, processing, completed, failed
    error_message = Column(String, nullable=True)
    processing_time = Column(Float, nullable=True)  # Processing time in seconds
    progress = Column(Float, default=0.0)  # Processing progress from 0 to 1
    feedback = Column(JSON, nullable=True)  # User feedback on processing quality
    
    owner = relationship("User", back_populates="receipts")
    extracted_transactions = relationship("ExtractedTransaction", back_populates="receipt")

class ExtractedTransaction(Base):
    __tablename__ = "extracted_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    description = Column(String)
    amount = Column(Float)
    date = Column(Date, nullable=True)
    category = Column(String, nullable=True)
    verified = Column(Boolean, default=False)
    added_to_expenses = Column(Boolean, default=False)
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id"))
    # Fields for agentic workflow
    user_verified = Column(Boolean, default=False)  # Indicates user has reviewed and verified
    confidence_score = Column(Float, default=1.0)  # AI confidence in extraction (0-1)
    original_text = Column(String, nullable=True)  # Original text from receipt for this item
    correction_history = Column(JSON, nullable=True)  # History of corrections made
    
    receipt = relationship("Receipt", back_populates="extracted_transactions")