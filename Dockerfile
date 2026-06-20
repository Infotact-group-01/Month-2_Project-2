# Use a lightweight Python base image
FROM python:3.9-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file from your Day 1 folder
COPY WEEK-01/DAY-01/requirements.txt .

# Install the dependencies
RUN pip install -r requirements.txt

# Copy your application code from your Day 1 folder
COPY WEEK-01/DAY-01/app.py .

# Command to run the application
CMD ["python", "app.py"]
