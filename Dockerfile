# Use the official Python image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file first to leverage Docker cache
COPY backend/requirements.txt ./backend/

# Install dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the entire project (backend and frontend) into the container
COPY . .

# Set working directory to backend where the FastAPI app is located
WORKDIR /app/backend

# Expose the port (Railway will override the PORT env variable automatically)
EXPOSE $PORT

# Command to run the application
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
