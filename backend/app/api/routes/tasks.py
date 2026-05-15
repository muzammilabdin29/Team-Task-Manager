from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from app.db.database import get_db
from app.models.task import Task
from app.models.project import Project, ProjectMember
from app.models.user import User
from app.schemas.task import TaskCreate, TaskUpdate, TaskOut
from app.core.security import get_current_user

router = APIRouter(prefix="/api/projects/{project_id}/tasks", tags=["Tasks"])


def get_project_or_404(project_id: int, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def assert_project_access(project: Project, current_user: User, db: Session):
    if current_user.role == "admin":
        return
    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project.id,
        ProjectMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Access denied to this project")


@router.post("", response_model=TaskOut, status_code=201)
def create_task(
    project_id: int,
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, db)
    assert_project_access(project, current_user, db)

    task = Task(
        title=data.title,
        description=data.description,
        status=data.status,
        priority=data.priority,
        project_id=project_id,
        created_by=current_user.id,
        due_date=data.due_date,
    )

    if data.assignee_ids:
        assignees = db.query(User).filter(User.id.in_(data.assignee_ids)).all()
        if len(assignees) != len(set(data.assignee_ids)):
            raise HTTPException(status_code=404, detail="One or more assignees not found")
        task.assignees = assignees

    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("", response_model=List[TaskOut])
def list_tasks(
    project_id: int,
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    assignee_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, db)
    assert_project_access(project, current_user, db)

    query = db.query(Task).filter(Task.project_id == project_id)
    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    if assignee_id:
        query = query.filter(Task.assignees.any(User.id == assignee_id))

    return query.order_by(Task.created_at.desc()).all()


@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, db)
    assert_project_access(project, current_user, db)
    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.put("/{task_id}", response_model=TaskOut)
def update_task(
    project_id: int,
    task_id: int,
    data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, db)
    assert_project_access(project, current_user, db)
    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "assignee_ids":
            if value is not None:
                assignees = db.query(User).filter(User.id.in_(value)).all()
                if len(assignees) != len(set(value)):
                    raise HTTPException(status_code=404, detail="One or more assignees not found")
                task.assignees = assignees
        else:
            setattr(task, field, value)
            
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=204)
def delete_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, db)
    assert_project_access(project, current_user, db)
    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
