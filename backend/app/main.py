from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.db.database import create_tables
from app.api.routes import auth, projects, tasks, users, admin_tasks

app = FastAPI(
    title="Team Task Manager API",
    description="Full-stack task management with role-based access control",
    version="1.0.0",
)

# CORS — allow frontend on same origin + localhost for dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:3000", "http://127.0.0.1:8000"],
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(tasks.router)
app.include_router(users.router)
app.include_router(admin_tasks.router)


@app.on_event("startup")
def on_startup():
    create_tables()
    print("Database tables created/verified")


@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Team Task Manager API is running"}


# Serve frontend static files
frontend_path = os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
static_path = os.path.join(frontend_path, "static")

if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    """Catch-all to serve the frontend SPA"""
    index_path = os.path.join(frontend_path, "templates", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend not found"}
