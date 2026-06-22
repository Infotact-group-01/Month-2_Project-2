FROM python:3.9-slim

WORKDIR /app

# Copy requirements first to leverage Docker layer caching
COPY WEEK-01/DAY-01/requirements.txt .

# Install dependencies
RUN pip install -r requirements.txt

# Copy the rest of the application
COPY WEEK-01/DAY-01/app.py .

# Run the application
CMD ["python", "app.py"]
