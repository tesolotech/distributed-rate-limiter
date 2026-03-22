require('dotenv').config();
const express = require('express');
const redis = require('redis');
const fs = require('fs');
const path = require('path');

const app = express();
const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT
});

const rateLimitScript = fs.readFileSync(path.join(__dirname, 'rate_limiter.lua'), 'utf8');

const RATE_LIMIT = parseInt(process.env.RATE_LIMIT);
const TIME_WINDOW = parseInt(process.env.TIME_WINDOW);

// Middleware for rate limiting
async function rateLimiter(req, res, next) {
  const ip = req.ip;
  try {
    const allowed = await client.eval(rateLimitScript, { keys: [ip], arguments: [String(RATE_LIMIT), String(TIME_WINDOW)] });
    if (allowed === 1) {
      next();
    } else {
      res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }
  } catch (err) {
    console.error('Error in rate limiter:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

app.use(rateLimiter);

app.get('/', (req, res) => {
  res.send('Welcome to the Rate Limited API!');
});

// Connect to Redis BEFORE starting the server
(async () => {
  try {
    await client.connect();
    console.log('Connected to Redis');
    
    const PORT = process.env.PORT;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
    process.exit(1);
  }
})();