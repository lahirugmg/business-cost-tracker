from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from typing import List
import os
import shutil
from pathlib import Path

import models
import schemas
import crud
import auth
from database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Financial Tracker API")

# Configure CORS - Maximum permissiveness for debugging
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins temporarily for debugging
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,  # Cache preflight requests for 10 minutes
)

# Setup upload directory
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Mount the upload directory as a static file server
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Dependency to get the database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Sample endpoint to test the API
@app.get("/")
def read_root():
    return {"message": "Welcome to Financial Tracker API"}

# Income endpoints
@app.post("/incomes/", response_model=schemas.Income)
def create_income(income: schemas.IncomeCreate, db: Session = Depends(get_db)):
    # Hardcode user_id=1 temporarily for testing purposes
    return crud.create_income(db=db, income=income, user_id=1)

@app.get("/incomes/", response_model=List[schemas.Income])
async def read_incomes(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    # Temporarily bypass authentication for testing
    # Return all incomes
    return crud.get_incomes(db, skip=skip, limit=limit)

@app.delete("/incomes/{income_id}", response_model=schemas.Income)
def delete_income(income_id: int, db: Session = Depends(get_db)):
    db_income = crud.delete_income(db, income_id=income_id)
    if db_income is None:
        raise HTTPException(status_code=404, detail="Income record not found")
    return db_income

# Expense endpoints
@app.post("/upload-attachment/")
async def upload_attachment(
    file: UploadFile = File(...)
):
    # Create a unique filename to avoid collisions
    unique_filename = f"{Path(file.filename).stem}_{os.urandom(4).hex()}{Path(file.filename).suffix}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Save the uploaded file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {"filename": file.filename, "stored_filename": unique_filename, "path": f"/uploads/{unique_filename}"}

@app.post("/expenses/", response_model=schemas.Expense)
def create_expense(expense: schemas.ExpenseCreate = None, db: Session = Depends(get_db)):
    # Hardcode user_id=1 temporarily for testing purposes
    return crud.create_expense(db=db, expense=expense, user_id=1)

@app.get("/expenses/", response_model=List[schemas.Expense])
def read_expenses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    expenses = crud.get_expenses(db, skip=skip, limit=limit)
    return expenses

@app.delete("/expenses/{expense_id}", response_model=schemas.Expense)
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    db_expense = crud.delete_expense(db, expense_id=expense_id)
    if db_expense is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    return db_expense

@app.post("/auth/google")
async def google_auth(token: schemas.TokenData, db: Session = Depends(get_db)):
    user_data = auth.verify_google_token(token.token)
    
    # Check if user exists, if not create new user
    db_user = crud.get_user_by_email(db, email=user_data["email"])
    if not db_user:
        db_user = crud.create_user(
            db,
            email=user_data["email"],
            google_id=user_data["sub"],
            name=user_data.get("name"),
            picture=user_data.get("picture")
        )
    
    # Create access token
    access_token = auth.create_access_token(
        data={"sub": user_data["email"]}
    )
    
    # Check if we're in demo mode
    if auth.DEMO_MODE:
        return {
            "access_token": access_token, 
            "token_type": "bearer",
            "demo_mode": True,
            "message": "Using demo mode authentication"
        }
    
    return {"access_token": access_token, "token_type": "bearer"} 