from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base
import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    member = "member"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="member", nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    owned_projects = relationship("Project", back_populates="owner", foreign_keys="Project.owner_id")
    project_memberships = relationship("ProjectMember", back_populates="user")
    created_tasks = relationship("Task", back_populates="creator", foreign_keys="Task.created_by")
