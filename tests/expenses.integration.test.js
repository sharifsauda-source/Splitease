process.env.NODE_ENV = 'test';
require('dotenv').config({ path: '.env.test' });

// Mock Mongo entirely for this test — avoids Jest+MongoDB driver hang issue
jest.mock('../src/config/mongo', () => ({
  connectMongo: jest.fn().mockResolvedValue({}),
  getDb: jest.fn(() => ({
    collection: () => ({
      insertOne: jest.fn().mockResolvedValue({}),
      find: () => ({
        sort: () => ({
          skip: () => ({
            limit: () => ({
              toArray: jest.fn().mockResolvedValue([])
            })
          })
        })
      })
    })
  }))
}));

const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');
const redis = require('../src/config/redis');

afterAll(async () => {
  await pool.end();
  await redis.quit();
});

describe('Full flow: signup -> login -> group -> expense -> balances', () => {
  const testEmail = `test_${Date.now()}@example.com`;
  let token;
  let groupId;

  test('signup creates a user', async () => {
    const res = await request(app)
      .post('/auth/signup')
      .send({ name: 'Integration Test', email: testEmail, password: 'pass123' });
    expect(res.status).toBe(201);
    expect(res.body.email).toBe(testEmail);
  });

  test('login returns a JWT', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: testEmail, password: 'pass123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    token = res.body.token;
  });

  test('creating a group auto-joins the creator', async () => {
    const res = await request(app)
      .post('/groups')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Group', base_currency: 'BDT' });
    expect(res.status).toBe(201);
    groupId = res.body.id;
  });

  test('adding an expense with no custom splits divides evenly', async () => {
    const res = await request(app)
      .post(`/groups/${groupId}/expenses`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Solo expense', amount: 100, currency: 'BDT' });
    expect(res.status).toBe(201);
    expect(res.body.expense.amount).toBe('100.00');
  });

  test('balances for a single-member group nets to zero', async () => {
    const res = await request(app)
      .get(`/groups/${groupId}/balances`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});