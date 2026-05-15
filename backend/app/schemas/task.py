from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime, date
from app.schemas.user import UserOut


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[str] = "todo"
    priority: Optional[str] = "medium"
    assignee_ids: Optional[list[int]] = []
    due_date: Optional[date] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v):
        if v not in ("todo", "in_progress", "done"):
            raise ValueError("Status must be todo, in_progress, or done")
        return v

    @field_validator("priority")
    @classmethod
    def valid_priority(cls, v):
        if v not in ("low", "medium", "high"):
            raise ValueError("Priority must be low, medium, or high")
        return v


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_ids: Optional[list[int]] = None
    due_date: Optional[date] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v):
        if v and v not in ("todo", "in_progress", "done"):
            raise ValueError("Status must be todo, in_progress, or done")
        return v


class TaskOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: str
    priority: str
    project_id: int
    created_by: int
    due_date: Optional[date]
    created_at: datetime
    updated_at: Optional[datetime]
    assignees: list[UserOut] = []
    creator: Optional[UserOut] = None

    class Config:
        from_attributes = True
