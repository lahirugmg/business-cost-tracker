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

class Expense(ExpenseBase):
    id: int
    user_id: int

    class Config:
        orm_mode = True

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