from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.database import get_db
from app.models.project import Project, ProjectMember
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectOut, AddMemberRequest
from app.core.security import get_current_user

router = APIRouter(prefix="/api/projects", tags=["Projects"])


def get_project_or_404(project_id: int, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def is_project_member(project: Project, user_id: int) -> bool:
    member_ids = [m.user_id for m in project.members]
    return user_id in member_ids or project.owner_id == user_id


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = Project(name=data.name, description=data.description, owner_id=current_user.id)
    db.add(project)
    db.flush()

    # Add owner as admin member
    membership = ProjectMember(project_id=project.id, user_id=current_user.id, role="admin")
    db.add(membership)
    db.commit()
    db.refresh(project)

    project.task_count = len(project.tasks)
    return project


@router.get("", response_model=List[ProjectOut])
def list_projects(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == "admin":
        projects = db.query(Project).all()
    else:
        # Members only see projects they belong to
        memberships = db.query(ProjectMember).filter(ProjectMember.user_id == current_user.id).all()
        project_ids = [m.project_id for m in memberships]
        projects = db.query(Project).filter(Project.id.in_(project_ids)).all()

    for p in projects:
        p.task_count = len(p.tasks)
    return projects


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, db)
    if current_user.role != "admin" and not is_project_member(project, current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    project.task_count = len(project.tasks)
    return project


@router.put("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: int,
    data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, db)
    if current_user.role != "admin" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only admin or owner can update project")

    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description
    db.commit()
    db.refresh(project)
    project.task_count = len(project.tasks)
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, db)
    if current_user.role != "admin" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only admin or owner can delete project")
    db.delete(project)
    db.commit()


@router.post("/{project_id}/members", status_code=201)
def add_member(
    project_id: int,
    data: AddMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, db)
    if current_user.role != "admin" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only admin or owner can add members")

    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == data.user_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member")

    member = ProjectMember(project_id=project_id, user_id=data.user_id, role=data.role)
    db.add(member)
    db.commit()
    return {"message": "Member added successfully"}


@router.delete("/{project_id}/members/{user_id}", status_code=204)
def remove_member(
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    project = get_project_or_404(project_id, db)
    if current_user.role != "admin" and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only admin or owner can remove members")

    member = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    db.delete(member)
    db.commit()
