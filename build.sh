#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Define image name and version
IMAGE_NAME="shuunifra/mydogemask-server-mock"
VERSION=${1:-"0.1.0"} # Use the first argument as version, or default to "0.1.0"

IMAGE_TAG="${IMAGE_NAME}:${VERSION}"

echo "Building Docker image: ${IMAGE_TAG}"

docker build -t "${IMAGE_TAG}" .

echo "Successfully built ${IMAGE_TAG}"