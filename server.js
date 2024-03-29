const http = require('http');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const exp = require('constants');
const requestIp = require('request-ip')

let port = 3000;
let clientIP;
let db = initializeDatabase(); // Initialize the database on server start
const cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds - cleanup all expired images and tokens
const httpServer = http.createServer(requestHandler);

if (process.argv[2] && process.argv[2] === '-h') {
    console.log("----HELP----");
    console.log("Usage: node server.js [options]");
    console.log("");
    console.log("node server.js Start the server");
    console.log("node server.js -h Display this help message");
    console.log("node server.js -k [name] [expiration] Generate an API token with the specified name and expiration in days");
    console.log("node server.js -v [token] Validate an API token");
    console.log("node server.js -l List all uploaded images and all of their information");
    console.log("node server.js -l remove [id] Remove an image by id");
    console.log("node server.js -s List all API tokens and their information");
    console.log("node server.js -s remove [id] Remove an API token by id");
    console.log("node server.js -c Remove all expired images and API tokens");
    console.log("node server.js -purge images Remove all images");
    console.log("node server.js -purge tokens Remove all API tokens");
    console.log("node server.js -purge all Remove all images and API tokens");
} else if (process.argv[2] && process.argv[2] === '-k') {
    console.log('Generating API token');
    generateApiToken(process.argv[3], process.argv[4], (err, token) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(token);
    });
} else if (process.argv[2] && process.argv[2] === '-v') {
    console.log('Validating API token');
    validateApiToken(process.argv[3], isValid => {
        console.log(isValid ? 'Token is valid' : 'Token is not valid');
    });
} else if (process.argv[2] && process.argv[2] === '-l') {
    if (process.argv[3] && process.argv[3] === 'remove') {
        console.log('Removing image');

        db.get('SELECT filename filename FROM images WHERE id = ?', [process.argv[4]], function (err, row) {
            if (err || !row) {
                return;
            }
            fs.unlinkSync(path.join(__dirname, 'download', row.filename));
            return;
        });
        db.run('DELETE FROM images WHERE id = ?', [process.argv[4]], function (err) {
            if (err) {
                console.error('Error removing image from database', err);
                return;
            }
            console.log('Image removed successfully');
            console.log('');
        });
    }
    console.log('Listing all uploaded images');
    db.all('SELECT id id, token token, filename filename, ogfilename ogfilename, date date, expiration expiration FROM images', function (err, rows) {
        if (err) {
            console.error('Error listing images from database', err);
            return;
        }
        console.log('');
        console.log('id : token : filename : ogfilename : date : expiration');
        console.log('--------------------------------------------------------');
        rows.forEach(row => {
            let exp = new Date(0); // The 0 there is the key, which sets the date to the epoch
            exp.setUTCSeconds(row.expiration)
            if (exp < new Date()) {
                console.log('\x1b[31m%s\x1b[0m', row.id + ' : ' + row.token + ' : ' + row.filename + ' : ' + row.ogfilename + ' : ' + row.date + ' : ' + exp.toISOString());
            } else {
                console.log(row.id + ' : ' + row.token + ' : ' + row.filename + ' : ' + row.ogfilename + ' : ' + row.date + ' : ' + exp.toISOString());
            }
        });
        console.log('');
        console.log('\x1b[31m%s\x1b[0m', 'Red color indicates expired images');
        console.log('Use -l remove [id] to remove an image');
        console.log('Use -c to remove all expired images and API tokens');
        console.log('Use -purge images to remove all images');
    });
} else if (process.argv[2] && process.argv[2] === '-s') {
    if (process.argv[3] && process.argv[3] === 'remove') {
        console.log('Removing API token');
        db.run('DELETE FROM credentials WHERE id = ?', [process.argv[4]], function (err) {
            if (err) {
                console.error('Error removing api token from database', err);
                return;
            }
            console.log('API token removed successfully');
            console.log('');
        });
    }
    console.log('Listing all API tokens');
    db.all('SELECT id id, name name, apitoken apitoken, date date, expiration expiration FROM credentials', function (err, rows) {
        if (err) {
            console.error('Error listing api tokens from database', err);
            return;
        }
        console.log('');
        console.log('id : name : apitoken : date : expiration');
        console.log('---------------------------------------------');
        let exp = new Date(0); // The 0 there is the key, which sets the date to the epoch

        rows.forEach(row => {
            exp.setUTCSeconds(row.expiration)
            if (exp < new Date() && row.expiration != 0) {
                console.log('\x1b[31m%s\x1b[0m', row.id + ' : ' + row.name + ' : ' + row.apitoken + ' : ' + row.date + ' : ' + exp.toISOString());
            } else {
                if (row.expiration == 0) {
                    console.log(row.id + ' : ' + row.name + ' : ' + row.apitoken + ' : ' + row.date + ' : Never expires');
                } else {
                    console.log(row.id + ' : ' + row.name + ' : ' + row.apitoken + ' : ' + row.date + ' : ' + exp.toISOString());
                }
            }
        });

        console.log('');
        console.log('\x1b[31m%s\x1b[0m', 'Red color indicates expired API tokens');
        console.log('Use -s remove [id] to remove an API token');
        console.log('Use -c to remove all expired images and API tokens');
        console.log('Use -purge tokens to remove all API tokens');
    });
} else if (process.argv[2] && process.argv[2] === '-c') {
    console.log('Removing expired images and API tokens');
    console.log('');
    cleanupExpiredItems(() => {
        console.log('Cleanup completed.');
    });
} else if (process.argv[2] && process.argv[2] === '-purge') {
    if (process.argv[3] && process.argv[3] === 'images') {
        console.log('Removing all images');
        files = fs.readdirSync(path.join(__dirname, 'download'));
        files.forEach(file => {
            fs.unlinkSync(path.join(__dirname, 'download', file));
        });
        db.run('DELETE FROM images', function (err) {
            if (err) {
                console.error('Error removing images from database', err);
                return;
            }
            console.log('Images removed successfully');
            console.log('');
        });
    } else if (process.argv[3] && process.argv[3] === 'tokens') {
        console.log('Removing all API tokens');
        db.run('DELETE FROM credentials', function (err) {
            if (err) {
                console.error('Error removing api tokens from database', err);
                return;
            }
            console.log('API tokens removed successfully');
            console.log('');
        });
    } else if (process.argv[3] && process.argv[3] === 'all') {
        console.log('Removing all images and API tokens');
        files = fs.readdirSync(path.join(__dirname, 'download'));
        files.forEach(file => {
            fs.unlinkSync(path.join(__dirname, 'download', file));
        });
        db.run('DELETE FROM images', function (err) {
            if (err) {
                console.error('Error removing images from database', err);
                return;
            }
            console.log('');
            console.log('Images removed successfully');
            console.log('');

            db.run('DELETE FROM credentials', function (err) {
                if (err) {
                    console.error('Error removing api tokens from database', err);
                    return;
                }
                console.log('API tokens removed successfully');
                console.log('');
            });
        });
    }
} else {
    setInterval(performCleanup, cleanupInterval); // Perform cleanup at regular intervals
    console.log('Server is starting...');
    console.log('Cleanup interval: ' + cleanupInterval/(60*60*1000) + ' hours');
    httpServer.listen(port, () => {
        console.log('');
        console.log(new Date().toISOString());
        console.log('Server is listening on port ' + port);
        console.log('');
    });
}

function requestHandler(req, res) {
    clientIP = requestIp.getClientIp(req);
    if (req.url === '/') {
        sendIndexHtml(res);
        // } else if (req.url === '/list') {
        //     sendListOfUploadedImages(res);
    } else if (/\/dip\/[^\/]+$/.test(req.url)) {
        sendDisplayedImage(req.url, res);
    } else if (/\/download\/[^\/]+$/.test(req.url)) {
        sendDownloadedImage(req.url, res);
    } else if (req.url === '/upload' && req.method === 'POST') {
        saveUploadedImage(req, res);
    } else {
        sendInvalidRequest(res);
    }
}

function initializeDatabase() {
    const dbPath = path.join(__dirname, 'images.db');
    const dbExists = fs.existsSync(dbPath);
    const db = new sqlite3.Database(dbPath);

    if (!dbExists) {
        // Database file doesn't exist, create the database and the table
        db.serialize(() => {
            db.run(`CREATE TABLE images (
              id INTEGER PRIMARY KEY,
              token TEXT NOT NULL,
              filename TEXT NOT NULL,
              ogfilename TEXT NOT NULL,
              date DATETIME DEFAULT CURRENT_TIMESTAMP,
              expiration INTEGER
          )`);
            db.run(`CREATE TABLE credentials (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            apitoken TEXT NOT NULL,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            expiration INTEGER
        )`);
            console.log('Database and table created successfully.');
        });
    }

    return db;
}

function performCleanup() {
    console.log(new Date().toISOString());
    console.log('Performing cleanup...');
    console.log('');
    cleanupExpiredItems(() => {
        console.log('Cleanup completed.');
    });
}

function cleanupExpiredItems(callback) {
    let secondsNow = new Date().getTime() / 1000;
    let files = fs.readdirSync(path.join(__dirname, 'download'));
    
    // Remove expired images from storage
    files.forEach(file => {
        db.get('SELECT expiration expiration FROM images WHERE filename = ?', [file], function (err, row) {
            if (err || !row) {
                return;
            }
            if (secondsNow > row.expiration) {
                fs.unlinkSync(path.join(__dirname, 'download', file));
            }
        });
    });

    // Wait for a short time before deleting records from the database
    sleep(250).then(() => {
        // Delete expired images from the database
        db.run('DELETE FROM images WHERE expiration < ?', [secondsNow], function (err) {
            if (err) {
                console.error('Error removing expired images from database', err);
                return;
            }
            console.log('Expired images removed successfully');
            console.log('');
        });

        // Delete expired API tokens from the database
        db.run('DELETE FROM credentials WHERE expiration IS NOT 0 AND expiration < ?', [secondsNow], function (err) {
            if (err) {
                console.error('Error removing expired API tokens from database', err);
                return;
            }
            console.log('Expired API tokens removed successfully');
            console.log('');
            
            // Invoke the callback once cleanup is complete
            if (callback && typeof callback === 'function') {
                callback();
            }
        });
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateApiToken(name, expirationInDays, callback) {
    let token = generateToken();
    let secondsNow = new Date().getTime() / 1000;
    let expiration = 0;

    if (expirationInDays != 0) {
        expiration = (expirationInDays * 3600 * 24) + secondsNow; // Convert expiration to seconds and add to current time 0 means never expire
    }

    db.run('INSERT INTO credentials (name, apitoken, expiration) VALUES (?, ?, ?)', [name, token, expiration], function (err) {
        if (err) {
            console.error('Error saving api token to database', err);
            callback(err, null); // Pass error to callback
            return;
        }
        callback(null, token); // Pass token to callback
    });
}

function validateApiToken(token, callback) {
    let secondsNow = new Date().getTime() / 1000;
    db.get('SELECT * FROM credentials WHERE apitoken = ? AND (expiration > ? OR expiration == 0)', [token, secondsNow], function (err, row) {
        if (err || !row) {
            callback(false); // Pass false to indicate invalid token
        } else {
            callback(true); // Pass true to indicate valid token
        }
    });
}

function generateToken() {
    return crypto.randomBytes(20).toString('hex');
}

function sendIndexHtml(res) {
    let indexFile = path.join(__dirname, 'index.html');
    fs.readFile(indexFile, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text' });
            res.write('Image Not Found!');
            res.end();
        } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            // Display the token as a link
            let token = generateToken();
            content = content.toString().replace('<!-- insert token here -->', `<a href="/dip/${token}">${token}</a>`);
            res.write(content);
            res.end();
        }
    });
}

function sendDisplayedImage(url, res) {
    console.log('');
    console.log(new Date().toISOString());
    console.log('Incoming image display request');
    let token = url.split('/')[2]; // Extract token from URL
    db.get('SELECT filename filename, expiration expiration FROM images WHERE token = ?', [token], function (err, row) {
        if (err || !row) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Image Not Found!');
            console.log('Image Not Found');
            return;
        }

        let exp = new Date(0); // The 0 there is the key, which sets the date to the epoch
        exp.setUTCSeconds(row.expiration)

        if (new Date() > exp) {
            res.writeHead(401, { 'Content-Type': 'text/plain' });
            res.end('Image expired!');
            console.log('Image expired');
            return;
        }

        let fileName = row.filename;
        let file = path.join(__dirname, 'download', fileName);
        fs.readFile(file, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.write('Image Not Found!');
                console.log('Image Not Found');
                res.end();
            } else {
                const imageBase64 = Buffer.from(data).toString('base64');
                const imageSrc = `data:image/png;base64,${imageBase64}`;
                const htmlContent = `
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
                                <a href="/download/${token}" class="download-button">Download <div class="arrow-down">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 490 490">
                                        <path fill="#ffffff" d="M52.8,311.3c-12.8-12.8-12.8-33.4,0-46.2c6.4-6.4,14.7-9.6,23.1-9.6s16.7,3.2,23.1,9.6l113.4,113.4V32.7
                                            c0-18,14.6-32.7,32.7-32.7c18,0,32.7,14.6,32.7,32.7v345.8L391,265.1c12.8-12.8,33.4-12.8,46.2,0c12.8,12.8,12.8,33.4,0,46.2
                                            L268.1,480.4c-6.1,6.1-14.4,9.6-23.1,9.6c-8.7,0-17-3.4-23.1-9.6L52.8,311.3z"/>
                                    </svg>
                                </div></a>
                            </div>
                        </div>
                    </body>
                    </html>
                `;
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.write(htmlContent);
                res.end();
                console.log('File name: ' + fileName);
                console.log('Image displayed successfully');
            }
        });
    });
}

function sendDownloadedImage(url, res) {
    console.log('');
    console.log(new Date().toISOString());
    console.log('Incoming image download request');
    console.log('IP: ' + clientIP);
    console.log('Token: ' + url.split('/')[2]);
    let token = url.split('/')[2]; // Extract token from URL
    db.get('SELECT filename filename, ogfilename ogfilename, expiration expiration FROM images WHERE token = ?', [token], function (err, row) {
        if (err || !row) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Image Not Found!');
            console.log('Image Not Found');
            return;
        }

        let exp = new Date(0); // The 0 there is the key, which sets the date to the epoch
        exp.setUTCSeconds(row.expiration)

        if (new Date() > exp) {
            res.writeHead(401, { 'Content-Type': 'text/plain' });
            res.end('Image expired!');
            console.log('Image expired');
            return;
        }

        let fileName = row.filename;
        let ogFileName = row.ogfilename;
        let file = path.join(__dirname, 'download', fileName);
        fs.readFile(file, (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Image Not Found!');
                console.log('Image Not Found');
            } else {
                res.writeHead(200, {
                    'Content-Type': 'image/png', // Adjust content type based on the image type
                    'Content-Disposition': `attachment; filename="${ogFileName}"`
                });
                res.end(data);
                console.log('File Name: ' + fileName);
                console.log('Original file Name: ' + ogFileName);
                console.log('Image downloaded successfully');
            }
        });
    });
}

function saveUploadedImage(req, res) {
    console.log('');
    console.log(new Date().toISOString());
    console.log('Incoming image upload request');
    console.log('IP: ' + clientIP);
    console.log('File Name: ' + req.headers.filename);

    let token = req.headers.token;
    let expirationInHours = req.headers.expiration || 24; // Extract expiration from request headers, default to 24 hours
    let secondsNow = new Date().getTime() / 1000;

    db.get('SELECT name FROM credentials WHERE apitoken = ? AND (expiration < ? OR expiration == 0)', [token, secondsNow], function (err, row) {
        if (err || !row) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden!');
            console.log('Auth Failed');
            return;
        }

        console.log('Auth OK - ' + row.name);
        console.log('Saving uploaded image');
        let fileName = crypto.randomBytes(20).toString('hex'); // Generate a random file name
        let fileExtension = '';

        // Extract file extension from content type header
        if (req.headers['content-type']) {
            fileExtension = '.' + req.headers['content-type'].split('/')[1];
        }

        // Default to .png if no extension found
        if (!fileExtension) {
            fileExtension = '.png';
        }

        fileName += fileExtension;

        let filePath = path.join(__dirname, 'download', fileName);
        let fileStream = fs.createWriteStream(filePath, { encoding: 'binary' }); // Specify binary encoding

        req.setEncoding('binary'); // Set encoding for request stream


        req.on('data', (chunk) => {
            fileStream.write(chunk, 'binary'); // Write only image data to file stream
        });

        req.on('end', () => {
            let secondsNow = new Date().getTime() / 1000;
            let expiration = (parseInt(expirationInHours) * 3600) + secondsNow; // Convert expiration to seconds and add to current time
            let ogFileName = req.headers.filename || fileName; // Extract original filename from request headers
            let token = generateToken();

            db.run('INSERT INTO images (token, filename, ogfilename, expiration) VALUES (?, ?, ?, ?)', [token, fileName, ogFileName, expiration], function (err) {
                if (err) {
                    console.error(err);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Error saving image info to database');
                    return;
                }

                // Send the token as a response
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(token);
            });
        });

        fileStream.on('error', (err) => {
            console.error(err);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Error saving uploaded file');
        });

        fileStream.on('finish', () => {
            fileStream.end(); // Close the file stream after finishing writing
        });

        console.log('Image saved successfully');
        console.log('Saved file name: ' + fileName);
        console.log('Expiration: ' + expirationInHours + ' hours');
    });
}

function sendInvalidRequest(res) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.write('Invalid Request');
    res.end();
}