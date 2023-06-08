const express = require('express');
const fs = require('fs');
const { pipeline } = require('stream');
const { promisify } = require('util');
const { createWriteStream } = require('fs');

const app = express();
const port = 3000;
const logFilePath = './log.txt';
const logDirectory = './logs';

// Create log directory if it doesn't exist
if (!fs.existsSync(logDirectory)) {
  fs.mkdirSync(logDirectory);
}

// Create a rotating write stream for the log file
const logStream = createWriteStream(logFilePath, { flags: 'a' });

// Pipeline promisification for async/await support
const pipelineAsync = promisify(pipeline);

// Middleware to track IP addresses and log to file
app.use((req, res, next) => {
  const ip = req.ip;
  const logEntry = `${new Date().toISOString()} - IP: ${ip}\n`;

  // Log IP to file
  logStream.write(logEntry, (err) => {
    if (err) {
      console.error('Error writing to log file:', err);
    }
  });

  next();
});

// Endpoint to get hit count
app.get('/', async (req, res) => {
  try {
    await pipelineAsync(
      fs.createReadStream(logFilePath),
      fs.createWriteStream(logFilePath + '.bak')
    );

    const uniqueIPs = new Set();

    const readStream = fs.createReadStream(logFilePath + '.bak', 'utf8');
    readStream.on('data', (chunk) => {
      const ips = chunk.match(/(\d{1,3}\.){3}\d{1,3}/g);
      if (ips) {
        ips.forEach((ip) => uniqueIPs.add(ip));
      }
    });

    readStream.on('end', () => {
      fs.unlink(logFilePath + '.bak', (err) => {
        if (err) {
          console.error('Error deleting backup log file:', err);
        }
      });

      res.send(`Hit count: ${uniqueIPs.size}`);
    });
  } catch (err) {
    console.error('Error reading log file:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
