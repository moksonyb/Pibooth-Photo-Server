const http = require('http');
const fs = require('fs');
const path = require('path');

let port = process.argv[2] || 3000;
const httpServer = http.createServer(requestHandler);
httpServer.listen(port, () => {console.log('server is listening on port '+ port)});

function requestHandler(req, res) {
  if (req.url === '/') {
      sendIndexHtml(res);
  } else if (req.url === '/list') {
      sendListOfUploadedImages(res);
  } else if (/\/display\/[^\/]+$/.test(req.url)) {
      sendDisplayedImage(req.url, res);
  } else if (/\/download\/[^\/]+$/.test(req.url)) {
      sendDownloadedImage(req.url, res);
  } else if (/\/upload\/[^\/]+$/.test(req.url)) {
      saveUploadedImage(req, res)
  } else {
      sendInvalidRequest(res);
  }
}

function sendIndexHtml(res){
  let indexFile = path.join(__dirname, 'index.html');
  fs.readFile(indexFile, (err, content) => {
    if(err){
      res.writeHead(404, {'Content-Type': 'text'});
      res.write('Image Not Found!');
      res.end();
    }else{
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.write(content);
      res.end();
    }
  })
}

function sendListOfUploadedImages(res){
  let uploadDir = path.join(__dirname, 'download');
  fs.readdir(uploadDir, (err, files) => {
    if(err){
      console.log(err);
      res.writeHead(400, {'Content-Type': 'application/json'});
      res.write(JSON.stringify(err.message));
      res.end();
    }else{
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.write(JSON.stringify(files));
      res.end();
    }
  })
}


function sendDisplayedImage(url, res) {
  let fileName = path.basename(url);
  if (!isImage(fileName)) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid file type. Only images are allowed.');
      return;
  }

  let file = path.join(__dirname, 'download', fileName);
  fs.readFile(file, (err, content) => {
      if (err) {
          res.writeHead(404, { 'Content-Type': 'text' });
          res.write('Image Not Found!');
          res.end();
      } else {
          fs.readFile(file, (err, data) => {
              if (err) {
                  console.error(err);
                  res.writeHead(500, { 'Content-Type': 'text/plain' });
                  res.end('Internal Server Error');
                  return;
              }
              const imageBase64 = Buffer.from(data).toString('base64');
              const imageSrc = `data:image/png;base64,${imageBase64}`;
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.write(`
                  <!DOCTYPE html>
                  <html lang="en">
                  <head>
                      <meta charset="UTF-8">
                      <meta name="viewport" content="width=device-width, initial-scale=1.0">
                      <title>Display Image</title>
                      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0-alpha1/dist/css/bootstrap.min.css" rel="stylesheet">
                      <style>
                          body, html {
                              margin: 0;
                              padding: 0;
                          }

                          .container-fluid {
                              display: flex;
                              justify-content: center;
                              align-items: center;
                              height: 100vh;
                              background-color: #ffffff;
                              position: relative;
                          }

                          .image-container {
                              max-height: 95vh;
                              overflow: auto;
                              position: relative;
                          }

                          .image-container img {
                              max-height: 95vh;
                              width: auto;
                              height: auto;
                          }

                          .download-button {
                            background-color: #242836;
                            color: #ffffff;
                            border: none;
                            border-radius: 20px;
                            bottom: 10px;
                            right: 10px;
                            padding: 10px 60px 10px 20px; /* Added extra padding for the arrow */
                            position: absolute;
                            z-index: 1;
                            overflow: hidden;
                            text-decoration: none; /* Removes underline */
                            display: inline-block; /* Ensures the button only takes up as much space as its content */
                          }

                          a.download-button:hover {
                            filter: brightness(0.8); /* Adjusts the brightness of the button on hover */
                          }
                          
                          .arrow-down {
                            position: absolute;
                            top: 50%;
                            right: 0;
                            transform: translateY(-50%);
                            width: 50px;
                            height: 100%;
                            background-color: #1C212E; /* Fill color for the arrow */
                            display: flex; /* Ensures proper alignment */
                            justify-content: center; /* Centers the SVG horizontally */
                            align-items: center; /* Centers the SVG vertically */
                          }

                          .arrow-down svg {
                            fill: #ffffff; /* Fill color for the arrow */
                            width: 20px; /* Adjusted width */
                            height: 20px; /* Adjusted height */
                            display: block; /* Ensures proper alignment */
                            margin: 0 auto; /* Centers the SVG horizontally */
                          }
                          
                          
                      </style>
                  </head>
                  <body>
                      <div class="container-fluid">
                          <div class="image-container">
                              <img src="${imageSrc}" class="img-fluid" alt="Displayed Image">
                              <a href="/download/${fileName}" class="download-button">Download <div class="arrow-down">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 490 490">
                                <path fill="#ffffff" d="M52.8,311.3c-12.8-12.8-12.8-33.4,0-46.2c6.4-6.4,14.7-9.6,23.1-9.6s16.7,3.2,23.1,9.6l113.4,113.4V32.7
                                    c0-18,14.6-32.7,32.7-32.7c18,0,32.7,14.6,32.7,32.7v345.8L391,265.1c12.8-12.8,33.4-12.8,46.2,0c12.8,12.8,12.8,33.4,0,46.2
                                    L268.1,480.4c-6.1,6.1-14.4,9.6-23.1,9.6c-8.7,0-17-3.4-23.1-9.6L52.8,311.3z"/>
                              </svg>
                            </div></a>


                      </div>
                  </body>
                  </html>
              `);
              res.end();
          });
      }
  });
}











function sendDownloadedImage(url, res) {
  let fileName = path.basename(url);
  if (!isImage(fileName)) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid file type. Only images are allowed.');
      return;
  }

  let file = path.join(__dirname, 'download', fileName);
  fs.readFile(file, (err, data) => {
      if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Image Not Found!');
      } else {
          res.writeHead(200, {
              'Content-Type': 'image/png', // Adjust content type based on the image type
              'Content-Disposition': `attachment; filename="${fileName}"`
          });
          res.end(data);
      }
  });
}




function displayUploadedImage(url, res){
  let file = path.join(__dirname, url);
  fs.readFile(file, (err, content) => {
    if(err){
      res.writeHead(404, {'Content-Type': 'text'});
      res.write('Image Not Found!');
      res.end();
    }else{
      res.writeHead(200, {'Content-Type': 'application/octet-stream'});
      res.write(content);
      res.end();
    }
  })
}



function saveUploadedImage(req, res){
  console.log('saving uploaded file');
  let fileName = path.basename(req.url);
  let file = path.join(__dirname, 'download', fileName)
  req.pipe(fs.createWriteStream(file));
  req.on('end', () => {
    res.writeHead(200, {'Content-Type': 'text'});
    res.write('uploaded succesfully');
    res.end();
  })
}

function sendInvalidRequest(res){
  res.writeHead(400, {'Content-Type': 'application/json'});
  res.write('Invalid Request');
  res.end(); 
}

function isImage(filename) {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif'];
  const ext = path.extname(filename).toLowerCase();
  return imageExtensions.includes(ext);
}

function saveUploadedImage(req, res) {
  console.log('saving uploaded file');
  let fileName = path.basename(req.url);
  if (!isImage(fileName)) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid file type. Only images are allowed.');
      return;
  }

  let file = path.join(__dirname, 'download', fileName);
  req.pipe(fs.createWriteStream(file));
  req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Uploaded successfully');
  });
}
