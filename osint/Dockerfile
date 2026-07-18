FROM python:3.12-slim

WORKDIR /app

# Install system deps (httpx needs these for SSL)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY osint/pyproject.toml ./pyproject.toml
RUN pip install --no-cache-dir "fastapi>=0.115.0" "uvicorn[standard]>=0.34.0" \
    "httpx>=0.28.0" "python-dotenv>=1.1.0" "redis>=5.3.0"

# Copy source
COPY osint/app/ ./app/

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]
