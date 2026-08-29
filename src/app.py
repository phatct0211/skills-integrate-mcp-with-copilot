"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

import json
import os
import secrets
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Mergington High School API",
              description="API for viewing and signing up for extracurricular activities")

TEACHER_SESSIONS = {}
current_dir = Path(__file__).parent
teacher_store_path = current_dir / "teachers.json"


def load_teachers():
    with teacher_store_path.open("r", encoding="utf-8") as file:
        data = json.load(file)
    return data.get("teachers", [])


def get_teacher_from_token(authorization: str | None = Header(default=None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = parts[1]
    teacher = TEACHER_SESSIONS.get(token)
    if not teacher:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    return teacher


# Mount the static files directory
app.mount("/static", StaticFiles(directory=os.path.join(Path(__file__).parent,
          "static")), name="static")

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"]
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"]
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"]
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"]
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"]
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"]
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"]
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"]
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"]
    }
}


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/activities")
def get_activities():
    return activities


@app.post("/admin/login")
def login_admin(username: str, password: str):
    """Authenticate a teacher and issue a session token."""
    teachers = load_teachers()
    matched_teacher = next(
        (teacher for teacher in teachers
         if teacher.get("username") == username and teacher.get("password") == password),
        None,
    )

    if matched_teacher is None:
        raise HTTPException(status_code=401, detail="Invalid teacher credentials")

    token = secrets.token_urlsafe(32)
    TEACHER_SESSIONS[token] = username
    return {"message": "Logged in successfully", "teacher": username, "token": token}


@app.post("/admin/logout")
def logout_admin(authorization: str | None = Header(default=None)):
    teacher = get_teacher_from_token(authorization)
    for token, value in list(TEACHER_SESSIONS.items()):
        if value == teacher:
            del TEACHER_SESSIONS[token]
            break
    return {"message": "Logged out successfully"}


@app.get("/admin/me")
def get_current_teacher(authorization: str | None = Header(default=None)):
    teacher = get_teacher_from_token(authorization)
    return {"teacher": teacher}


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str, authorization: str | None = Header(default=None)):
    """Register a student for an activity. Teacher-only access."""
    get_teacher_from_token(authorization)

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is not already signed up
    if email in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is already signed up"
        )

    # Add student
    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str, authorization: str | None = Header(default=None)):
    """Unregister a student from an activity. Teacher-only access."""
    get_teacher_from_token(authorization)

    # Validate activity exists
    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Get the specific activity
    activity = activities[activity_name]

    # Validate student is signed up
    if email not in activity["participants"]:
        raise HTTPException(
            status_code=400,
            detail="Student is not signed up for this activity"
        )

    # Remove student
    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
