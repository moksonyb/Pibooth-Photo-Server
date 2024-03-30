#!/bin/bash

# Build the Docker image
docker build -t pibooth-images-server:1.0.

# Run the Docker container with relative path for images directory and restart always
docker run -p 3000:3000 -v "$(pwd)/download:/usr/src/app/download" -v $(pwd)/data:/usr/src/app/data --restart always -d pibooth-images-server:latest
