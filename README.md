# TaskFlow — Team Task Manager

TaskFlow is a full-stack web application designed for team project management. It provides role-based access control, task assignment, and progress tracking.

**Tech Stack:** 
- **Frontend:** Vanilla HTML, CSS, JavaScript (Single Page Application)
- **Backend:** FastAPI, Pydantic, SQLAlchemy
- **Database:** SQLite (local development) / PostgreSQL (production)

---

## Architecture Overview

The project is structured as a monolithic application where the FastAPI backend serves both the JSON API and the static frontend files.

- **Frontend:** A Single Page Application (SPA). All UI logic, API calls, and state management are contained in a single `app.js` file. The backend serves `index.html` as the entry point.
- **Backend:** A RESTful API built with FastAPI. It handles routing, database transactions, email sending, and JWT authentication.
- **Database:** SQLAlchemy ORM maps Python objects to the relational database.

---

## Core Features

- **OTP Email Authentication:** Users must verify their email via a 6-digit OTP before their account is created.
- **JWT Authorization:** Secured endpoints using short-lived access tokens.
- **Role System:** 
  - `admin`: Can view all projects, manage all users, and delete any project.
  - `member`: Can only view projects they are assigned to or own.
- **Project Management:** Users can create projects and invite other registered users as members.
- **Task Management:** 
  - Create, edit, and delete tasks within a project.
  - Set task priority (Low, Medium, High) and status (To Do, In Progress, Done).
  - Assign multiple team members to a single task.
- **Views:** Dashboard summary, Kanban board, and a "My Tasks" unified list.

---

## Database Schema Highlights

The application uses SQLAlchemy for database modeling. Key models include:

- **User:** Stores core user information and hashed passwords.
- **Project & ProjectMember:** Projects belong to an owner but can have multiple members via the `ProjectMember` association table.
- **Task & TaskAssignees:** Tasks belong to a specific project. A task can have multiple assignees via the `task_assignees` relational table.
- **PendingRegistration:** A temporary table used during the signup process to store user details and the generated OTP code until the email is verified.

---

## The Registration Flow (OTP)

1. **Submit Form:** The user submits their name, email, password, and role.
2. **Store Pending:** The backend stores this data in the `pending_registrations` table with a 6-digit OTP code and a 10-minute expiration.
3. **Send Email:** The backend uses `smtplib` to email the OTP to the user.
4. **Verify:** The user submits the OTP. The backend validates it against the `pending_registrations` table.
5. **Create User:** If valid, the record is moved from `pending_registrations` to the main `users` table, and a JWT is issued.

---

## Local Development

### Prerequisites
- Python 3.11+
- pip

### Setup Instructions

```bash
# Clone repo
git clone <your-repo-url>
cd team-task-manager

# Create virtual environment
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate

# Install dependencies
cd backend
pip install -r requirements.txt

# Set up environment
cp .env.example .env
```

### Configuration (`.env`)
You must add your SMTP credentials (like a Google App Password) to the `.env` file for the OTP emails to work.
SQLite works out of the box for the database.

### Running the Server
```bash
uvicorn app.main:app --reload --port 8000
```
- Web App: http://localhost:8000
- API Documentation (Swagger): http://localhost:8000/docs

---

## API Reference

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Start registration, sends OTP |
| POST | `/api/auth/verify-otp` | ❌ | Verify OTP, complete registration |
| POST | `/api/auth/resend-otp` | ❌ | Resend OTP email |
| POST | `/api/auth/login` | ❌ | Login, returns JWT |
| GET | `/api/auth/me` | ✅ | Current user info |

### Projects
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/projects` | ✅ | List accessible projects |
| POST | `/api/projects` | ✅ | Create project |
| GET | `/api/projects/{id}` | ✅ | Project details + members |
| PUT | `/api/projects/{id}` | ✅ | Update project |
| DELETE | `/api/projects/{id}` | ✅ | Delete project |
| POST | `/api/projects/{id}/members` | ✅ | Add member |
| DELETE | `/api/projects/{id}/members/{uid}` | ✅ | Remove member |

### Tasks
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/projects/{id}/tasks` | ✅ | List tasks (filterable) |
| POST | `/api/projects/{id}/tasks` | ✅ | Create task (accepts `assignee_ids`) |
| PUT | `/api/projects/{id}/tasks/{tid}` | ✅ | Update task |
| DELETE | `/api/projects/{id}/tasks/{tid}` | ✅ | Delete task |

### Users (Admin)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users` | ✅ | List all users |
| GET | `/api/users/dashboard/stats` | ✅ | Dashboard stats |

---

## Deployment (Railway)

This repository is pre-configured for Railway deployment using `nixpacks.toml` and `railway.toml`.

1. Push your code to a GitHub repository.
2. In Railway, create a new project -> **Deploy from GitHub repo**.
3. Add a **PostgreSQL** database service (Railway will automatically inject the `DATABASE_URL` variable).
4. Add your `.env` variables (like `SECRET_KEY` and your `SMTP_*` variables) into the Railway project variables.
5. Generate a public domain in the Networking settings.
