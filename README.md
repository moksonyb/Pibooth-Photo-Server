# Pibooth Images Server
A simple Node.JS server to manage image uploads and downloads from PiBooth. The Pibooth plugin can be found here.

## 1. Running in terminal

### 1.1 Pre-requisit
```bash
npm install
```


### 1.2 How to get the project
Just download zip folder or clone the repo using git command on your system.

### 1.3 Start server with default port 3000
```bash
node server.js
```

### 1.4 Server management cli
```
Usage: node server.js [options]

node server.js Start the server
node server.js -h Display this help message
node server.js -k [name] [expiration] Generate an API token with the specified name and expiration in days
node server.js -v [token] Validate an API token
node server.js -l List all uploaded images and all of their information
node server.js -l remove [id] Remove an image by id
node server.js -s List all API tokens and their information
node server.js -s remove [id] Remove an API token by id
node server.js -c Remove all expired images and API tokens
node server.js -purge images Remove all images
node server.js -purge tokens Remove all API tokens
node server.js -purge all Remove all images and API tokens
```

### 1.5 API Documentation: `/upload`

#### Endpoint:
```
POST /upload
```

#### Headers:
- `token`: API token for authentication (required)
- `filename`: Original filename of the uploaded image (optional)
- `expiration`: Expiration time for the uploaded image in hours (optional, defaults to 24 hours)

#### Body:
The request body should contain the binary data of the image file.

#### Description:
This endpoint allows users to upload images to the server. The uploaded images are stored in a specified directory on the server and their metadata (such as token, filename, original filename, and expiration) are stored in a SQLite database.

#### Example Usage:
```http
POST /upload
Content-Type: application/octet-stream
token: [API_TOKEN]
filename: example_image.png
expiration: 48

[Binary Data of the Image]
```

#### Possible Responses:
- `200 OK`: The image was successfully uploaded. The response body contains the token assigned to the uploaded image.
- `400 Bad Request`: The request is invalid.
- `403 Forbidden`: Authentication failed. The provided API token is invalid or expired.
- `500 Internal Server Error`: An error occurred while processing the request, such as saving the image file or storing metadata in the database.

### 1.6 API Documentation: `/dip`

#### Endpoint:
```
GET /dip/:token
```

#### Description:
This endpoint is used to display an uploaded image based on its token. It retrieves the image file associated with the provided token and renders it as an HTML page, allowing users to view the image in their web browser.

#### Parameters:
- `:token`: The unique token assigned to the uploaded image.

#### Example Usage:
```
GET /dip/your_token_here
```

#### Possible Responses:
- `200 OK`: The image is successfully displayed.
- `404 Not Found`: The image associated with the provided token does not exist.

### 1.7 API Documentation: `/download`

#### Endpoint:
```
GET /download/:token
```

#### Description:
This endpoint is used to download an uploaded image based on its token. It retrieves the image file associated with the provided token and sends it as a binary response, allowing users to download the image file to their local machine.

#### Parameters:
- `:token`: The unique token assigned to the uploaded image.

#### Example Usage:
```
GET /download/your_token_here
```

#### Possible Responses:
- `200 OK`: The image file is successfully downloaded.
- `404 Not Found`: The image associated with the provided token does not exist.

These endpoints provide convenient ways to view and download uploaded images from the server based on their tokens.


## 2. Running in docker

### 2.1 Build docker image


## 2. Running in docker

### 2.1 Build docker image

```bash
docker build -t pibooth-images-server:1.0 .
```

### 2.2 Run via docker container

Execute the following command in the terminal:

```bash
docker run -d -v "$(pwd)/download:/usr/src/app/download" -p 3000:3000 --restart=always pibooth-images-server:1.0
```

Alternatively, you can execute the provided shell script:

```bash
chmod +x docker-run.sh
./docker-run.sh
```

Note: Uploaded files will be stored in the `download` directory in your local disk.

### 2.3 Open in browser to access download/upload UI
```
Example: http://localhost:3000
```