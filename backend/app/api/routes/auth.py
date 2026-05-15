from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
import random
import string
from datetime import datetime, timedelta
from app.models.otp import PendingRegistration
from app.schemas.user import RegisterRequest, VerifyOtpRequest, ResendOtpRequest, UserLogin, UserOut, Token
from app.core.email import send_otp_email
from app.core.config import settings
from app.core.security import (
    verify_password, get_password_hash,
    create_access_token, get_current_user
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


@router.post("/register", status_code=202)
def register(user_data: RegisterRequest, db: Session = Depends(get_db)):
    # Check if email already exists in actual users table
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Generate OTP
    otp_code = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

    # Check if there is an existing pending registration
    pending = db.query(PendingRegistration).filter(PendingRegistration.email == user_data.email).first()
    if pending:
        # Update existing
        pending.name = user_data.name
        pending.hashed_password = get_password_hash(user_data.password)
        pending.role = user_data.role
        pending.otp_code = otp_code
        pending.expires_at = expires_at
    else:
        # Create new
        pending = PendingRegistration(
            name=user_data.name,
            email=user_data.email,
            hashed_password=get_password_hash(user_data.password),
            role=user_data.role,
            otp_code=otp_code,
            expires_at=expires_at,
        )
        db.add(pending)
    
    db.commit()

    # For local development: print the OTP to the console so the user can test
    print(f"\n" + "="*50)
    print(f"  DEVELOPMENT MODE - OTP GENERATED")
    print(f"  Email: {user_data.email}")
    print(f"  OTP Code: {otp_code}")
    print("="*50 + "\n")

    # Send email
    email_sent = send_otp_email(user_data.email, otp_code)
    if not email_sent:
        print(f"WARNING: Failed to send OTP email to {user_data.email}. Please use the code printed above.")

    return {"message": "OTP sent to email (and printed to server console). Please verify to complete registration."}


@router.post("/verify-otp", response_model=Token, status_code=201)
def verify_otp(data: VerifyOtpRequest, db: Session = Depends(get_db)):
    pending = db.query(PendingRegistration).filter(PendingRegistration.email == data.email).first()
    
    if not pending:
        raise HTTPException(status_code=400, detail="No pending registration found for this email")
    
    if pending.otp_code != data.otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP code")
        
    if pending.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    # OTP is valid, create the actual user
    user = User(
        name=pending.name,
        email=pending.email,
        hashed_password=pending.hashed_password,
        role=pending.role,
    )
    db.add(user)
    
    # Delete the pending registration
    db.delete(pending)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/resend-otp", status_code=202)
def resend_otp(data: ResendOtpRequest, db: Session = Depends(get_db)):
    pending = db.query(PendingRegistration).filter(PendingRegistration.email == data.email).first()
    
    if not pending:
        raise HTTPException(status_code=400, detail="No pending registration found for this email")

    # Generate new OTP
    otp_code = generate_otp()
    pending.otp_code = otp_code
    pending.expires_at = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    db.commit()

    # For local development: print the OTP to the console
    print(f"\n" + "="*50)
    print(f"  DEVELOPMENT MODE - RESENT OTP")
    print(f"  Email: {data.email}")
    print(f"  OTP Code: {otp_code}")
    print("="*50 + "\n")

    # Send email
    email_sent = send_otp_email(data.email, otp_code)
    if not email_sent:
        print(f"WARNING: Failed to resend OTP email to {data.email}. Please use the code printed above.")
    
    return {"message": "A new OTP has been sent (and printed to console)"}


@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is inactive")

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
