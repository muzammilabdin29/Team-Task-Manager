from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Date, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

task_assignees = Table(
    "task_assignees",
    Base.metadata,
    Column("task_id", Integer, ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(30), default="todo")          # todo | in_progress | done
    priority = Column(String(20), default="medium")      # low | medium | high
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    due_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    project = relationship("Project", back_populates="tasks")
    assignees = relationship("User", secondary=task_assignees, backref="assigned_tasks")
    creator = relationship("User", back_populates="created_tasks", foreign_keys=[created_by])
