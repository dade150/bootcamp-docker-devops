// percorso-be/src/index.js
const express = require('express');
const { Pool } = require('pg');
const Redis = require('ioredis');

const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis = new Redis(process.env.REDIS_URL);

app.use(express.json());

app.get('/healthz', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    await redis.ping();
    res.json({ status: 'ok', deps: ['db', 'cache'] });
  } catch (err) {
    res.status(503).json({ status: 'degraded', error: err.message });
  }
});

app.get('/accounts', async (req, res) => {
  const cached = await redis.get('accounts:all');
  if (cached) return res.json(JSON.parse(cached));

  const { rows } = await pool.query('SELECT id, iban, balance FROM accounts');
  await redis.setex('accounts:all', 30, JSON.stringify(rows));
  res.json(rows);
});

let server;
function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  server.close(async () => {
    await pool.end();
    redis.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 9000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server = app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});