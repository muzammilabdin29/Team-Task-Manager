from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.user import User
from app.schemas.user import UserOut, UserUpdate
from app.core.security import get_current_user, require_admin

router = APIRouter(prefix="/api/users", tags=["Users"])


@router.get("", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """All authenticated users can list users (for assignment etc.)"""
    return db.query(User).filter(User.is_active == True).all()


@router.get("/{user_id}", response_model=UserOut)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Cannot update other users")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if data.name:
        user.name = data.name
    if data.email:
        user.email = data.email
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    user.is_active = False
    db.commit()


@router.get("/dashboard/stats", tags=["Dashboard"])
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.task import Task
    from app.models.project import Project, ProjectMember
    from datetime import date
    from sqlalchemy import func

    if current_user.role == "admin":
        total_projects = db.query(func.count(Project.id)).scalar()
        total_tasks = db.query(func.count(Task.id)).scalar()
        tasks_todo = db.query(func.count(Task.id)).filter(Task.status == "todo").scalar()
        tasks_in_progress = db.query(func.count(Task.id)).filter(Task.status == "in_progress").scalar()
        tasks_done = db.query(func.count(Task.id)).filter(Task.status == "done").scalar()
        overdue_tasks = db.query(func.count(Task.id)).filter(
            Task.due_date < date.today(), Task.status != "done"
        ).scalar()
        total_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar()
    else:
        memberships = db.query(ProjectMember).filter(ProjectMember.user_id == current_user.id).all()
        project_ids = [m.project_id for m in memberships]
        total_projects = len(project_ids)
        total_users = None

        task_q = db.query(Task).filter(Task.project_id.in_(project_ids))
        total_tasks = task_q.count()
        tasks_todo = task_q.filter(Task.status == "todo").count()
        tasks_in_progress = db.query(Task).filter(
            Task.project_id.in_(project_ids), Task.status == "in_progress"
        ).count()
        tasks_done = db.query(Task).filter(
            Task.project_id.in_(project_ids), Task.status == "done"
        ).count()
        overdue_tasks = db.query(Task).filter(
            Task.project_id.in_(project_ids),
            Task.due_date < date.today(),
            Task.status != "done"
        ).count()

    return {
        "total_projects": total_projects,
        "total_tasks": total_tasks,
        "tasks_todo": tasks_todo,
        "tasks_in_progress": tasks_in_progress,
        "tasks_done": tasks_done,
        "overdue_tasks": overdue_tasks,
        "total_users": total_users,
    }
