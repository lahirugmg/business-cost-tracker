from sqlalchemy.orm import Session
import models
import schemas

# User operations
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    # In a real app, hash the password here
    fake_hashed_password = user.password + "notreallyhashed"
    db_user = models.User(email=user.email, hashed_password=fake_hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# Income operations
def get_incomes(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Income).offset(skip).limit(limit).all()

def create_income(db: Session, income: schemas.IncomeCreate, user_id: int = 1):
    db_income = models.Income(**income.dict(), user_id=user_id)
    db.add(db_income)
    db.commit()
    db.refresh(db_income)
    return db_income

def delete_income(db: Session, income_id: int):
    db_income = db.query(models.Income).filter(models.Income.id == income_id).first()
    if db_income is None:
        return None
    db.delete(db_income)
    db.commit()
    return db_income

# Expense operations
def get_expenses(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Expense).offset(skip).limit(limit).all()

def create_expense(db: Session, expense: schemas.ExpenseCreate, user_id: int = 1):
    db_expense = models.Expense(**expense.dict(), user_id=user_id)
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense

def delete_expense(db: Session, expense_id: int):
    db_expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if db_expense is None:
        return None
    db.delete(db_expense)
    db.commit()
    return db_expense