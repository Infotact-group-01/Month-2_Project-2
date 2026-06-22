FROM python:3.9-slim

WORKDIR /app

# Copy everything from your DAY-01 folder into the /app folder in the container
COPY WEEK-01/DAY-01/ /app/

# Install the dependencies
RUN pip install -r requirements.txt

# The application is already copied, just run it
CMD ["python", "app.py"]
