from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: Optional[str] = "member"

    @field_validator("password")
    @classmethod
    def password_strength(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

    @field_validator("role")
    @classmethod
    def valid_role(cls, v):
        if v not in ("admin", "member"):
            raise ValueError("Role must be 'admin' or 'member'")
        return v


class RegisterRequest(UserCreate):
    pass


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp_code: str


class ResendOtpRequest(BaseModel):
    email: EmailStr


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


class TokenData(BaseModel):
    user_id: Optional[int] = None
