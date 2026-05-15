from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from app.db.database import get_db
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskOut
from app.core.security import get_current_user, require_admin

router = APIRouter(prefix="/api/admin/tasks", tags=["Admin Tasks"])

@router.get("", response_model=List[TaskOut])
def get_all_tasks(
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assignee_id: Optional[int] = Query(None),
    project_id: Optional[int] = Query(None),
    due_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Admin endpoint to view all tasks across all projects with filters"""
    query = db.query(Task)
    
    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)
    if project_id:
        query = query.filter(Task.project_id == project_id)
    if due_date:
        query = query.filter(Task.due_date == due_date)
        
    return query.order_by(Task.due_date.asc(), Task.created_at.desc()).all()
