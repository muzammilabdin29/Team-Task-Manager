from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.schemas.user import UserOut


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ProjectMemberOut(BaseModel):
    id: int
    user_id: int
    role: str
    joined_at: datetime
    user: UserOut

    class Config:
        from_attributes = True


class ProjectOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    owner_id: int
    created_at: datetime
    owner: UserOut
    members: List[ProjectMemberOut] = []
    task_count: Optional[int] = 0

    class Config:
        from_attributes = True


class AddMemberRequest(BaseModel):
    user_id: int
    role: Optional[str] = "member"
