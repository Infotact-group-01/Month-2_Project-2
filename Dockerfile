FROM python:3.9-slim

WORKDIR /app

# Copy files relative to the Dockerfile location
# Remove the leading slash so Docker looks in the current build context
COPY WEEK-01/DAY-01/requirements.txt .
COPY WEEK-01/DAY-01/app.py .

# Install dependencies
RUN pip install -r requirements.txt

# Run the application
CMD ["python", "app.py"]