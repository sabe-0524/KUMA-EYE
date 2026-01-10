FROM python:3.11-slim

# Install system dependencies including ffmpeg for video processing and libraries for PyTorch/OpenCV
RUN apt-get update && apt-get install -y \
    postgresql-client \
    libpq-dev \
    gcc \
    g++ \
    ffmpeg \
    fonts-dejavu-core \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create models directory
RUN mkdir -p /app/models

# Set environment variables for Cloud Run
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# Expose port (Cloud Run uses PORT environment variable)
EXPOSE 8080

# Run the application (production mode without --reload)
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 2
