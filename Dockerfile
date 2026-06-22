FROM python:3.9-slim

WORKDIR /app

# Copy the specific files from the nested directory
# We use the full path relative to the root of the repository
COPY WEEK-01/DAY-01/requirements.txt .
COPY WEEK-01/DAY-01/app.py .

# Install dependencies
RUN pip install -r requirements.txt

# Run the application
CMD ["python", "app.py"]