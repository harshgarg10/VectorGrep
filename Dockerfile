# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set up a new user named "user" with user ID 1000
# Hugging Face Spaces run containers as a non-root user for security
RUN useradd -m -u 1000 user

# Set the working directory to the user's home directory
WORKDIR /home/user/app

# Change ownership of the app directory to the new user
RUN chown -R user:user /home/user/app

# Switch to the "user" user
USER user

# Set environment variables
ENV PATH="/home/user/.local/bin:$PATH"
ENV PYTHONUNBUFFERED=1

# Copy the requirements file and install dependencies
COPY --chown=user:user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Copy the rest of the application files
COPY --chown=user:user . .

# Create the chroma_db directory to ensure it exists and is writable
RUN mkdir -p chroma_db

# Hugging Face Spaces Docker environments route traffic to port 7860
EXPOSE 7860

# Command to run the FastAPI application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
