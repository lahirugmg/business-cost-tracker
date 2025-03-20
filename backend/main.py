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

# Try to import routers, but don't fail if dependencies are missing
try:
    from routers import receipts
    has_receipts_router = True
    print("Receipts router loaded successfully")
except ImportError as e:
    has_receipts_router = False
    print(f"Warning: Receipt processing disabled due to missing dependencies: {e}")
    print("Running in demo mode with limited functionality")

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Financial Tracker API")

# Configure CORS - Allow specific origins for authentication to work properly
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",     # Frontend development server
        "http://127.0.0.1:3000",     # Alternative frontend URL
        "https://business-cost-tracker.vercel.app"  # Production URL if deployed
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["Content-Length", "X-Total-Count"],
    max_age=600  # Cache preflight requests for 10 minutes
)

# Setup upload directory
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Add a health check endpoint to allow frontend to check if backend is available
@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0", "demo_mode": auth.DEMO_MODE}

# Mount the upload directory as a static file server
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers
if 'has_receipts_router' in globals() and has_receipts_router:
    app.include_router(receipts.router, prefix="/receipts", tags=["receipts"])
    print("Receipts router added to the API")
else:
    print("Receipts router not available, running with limited functionality")

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

from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

@app.options("/auth/google")
async def auth_google_options():
    # Handle OPTIONS preflight request for the auth endpoint
    headers = {
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, Origin, X-Requested-With",
        "Access-Control-Allow-Credentials": "true",
    }
    return JSONResponse(content={}, headers=headers)

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
    
    # Create response with custom headers to ensure CORS works
    response_data = {
        "access_token": access_token,
        "token_type": "bearer",
        "demo_mode": auth.DEMO_MODE,
    }
    
    # Create response with CORS headers
    headers = {
        "Access-Control-Allow-Origin": "http://localhost:3000",
        "Access-Control-Allow-Credentials": "true",
    }
    
    # Add demo mode message if needed
    if auth.DEMO_MODE:
        response_data["message"] = "Using demo mode authentication"
        
    # Return the response with headers
    return JSONResponse(content=response_data, headers=headers)

# Run the app on startup
if __name__ == "__main__":
    import uvicorn
    print("Starting server at http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)