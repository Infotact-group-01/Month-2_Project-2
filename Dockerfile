FROM python:3.9-slim

WORKDIR /app

# Copy all files from the current folder (root)
COPY . .

# Install dependencies
RUN pip install -r requirements.txt

# Run the application
CMD ["python", "app.py"]