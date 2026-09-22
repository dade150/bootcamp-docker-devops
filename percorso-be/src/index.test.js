const request = require('supertest');
const { createApp, createPool, createRedis } = require('./index');
const { Pool } = require('pg');
const Redis = require('ioredis');

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: jest.fn(),
    end: jest.fn(),
  })),
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    setex: jest.fn(),
    ping: jest.fn(),
    disconnect: jest.fn(),
  }));
});

let mockPool;
let mockRedis;
let app;

beforeEach(() => {
  jest.clearAllMocks();
  mockPool = new Pool();
  mockRedis = new Redis();
  app = createApp(mockPool, mockRedis);
});

afterAll(async () => {
  await mockPool.end();
  mockRedis.disconnect();
});

describe('GET /healthz', () => {
  it('returns ok when db and cache are healthy', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    mockRedis.ping.mockResolvedValueOnce('PONG');

    const res = await request(app).get('/healthz');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', deps: ['db', 'cache'] });
  });

  it('returns degraded when db fails', async () => {
    mockPool.query.mockRejectedValueOnce(new Error('DB connection failed'));
    mockRedis.ping.mockResolvedValueOnce('PONG');

    const res = await request(app).get('/healthz');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.error).toBe('DB connection failed');
  });

  it('returns degraded when redis fails', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    mockRedis.ping.mockRejectedValueOnce(new Error('Redis connection failed'));

    const res = await request(app).get('/healthz');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.error).toBe('Redis connection failed');
  });
});

describe('GET /accounts', () => {
  it('returns cached accounts when available', async () => {
    const cachedAccounts = [{ id: 1, iban: 'IT60X0542811101000000123456', balance: 1000 }];
    mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedAccounts));

    const res = await request(app).get('/accounts');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(cachedAccounts);
    expect(mockRedis.get).toHaveBeenCalledWith('accounts:all');
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('fetches from db and caches when not cached', async () => {
    mockRedis.get.mockResolvedValueOnce(null);
    const dbAccounts = [{ id: 2, iban: 'IT60X0542811101000000123457', balance: 2000 }];
    mockPool.query.mockResolvedValueOnce({ rows: dbAccounts });
    mockRedis.setex.mockResolvedValueOnce('OK');

    const res = await request(app).get('/accounts');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(dbAccounts);
    expect(mockPool.query).toHaveBeenCalledWith('SELECT id, iban, balance FROM accounts');
    expect(mockRedis.setex).toHaveBeenCalledWith('accounts:all', 30, JSON.stringify(dbAccounts));
  });

  it('returns 500 when db query fails', async () => {
    mockRedis.get.mockResolvedValueOnce(null);
    mockPool.query.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/accounts');

    expect(res.status).toBe(500);
  });
});