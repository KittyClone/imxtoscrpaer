# backend/Dockerfile

# Use an official Python runtime as a parent image
FROM python:3.12-slim-buster

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY requirements.txt /app/

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your application code to the WORKDIR
COPY . /app

# Expose the port your FastAPI application will run on
EXPOSE 8000

# Command to run your application using Uvicorn
# 'app:app' means look for the 'app' variable in 'app.py'
# '--host 0.0.0.0' makes it accessible from outside the container
# '--port 8000' specifies the port it listens on, matching the EXPOSE instruction
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]