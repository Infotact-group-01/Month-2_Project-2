FROM python:3.9-slim

WORKDIR /app

# Copy the entire contents of the subfolder into the container
# Use a forward slash / even on Windows, as Docker environments are Linux-based
COPY WEEK-01/DAY-01/ .

# Install the dependencies
RUN pip install -r requirements.txt

# Run the application
CMD ["python", "app.py"]
