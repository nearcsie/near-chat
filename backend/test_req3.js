const request = require('supertest');
const { app } = require('./dist/index.js');
const pool = require('./dist/db.js').default; // Assuming db exports default pool

async function test() {
  try {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'TestRun',
      email: 'testrun@test.com',
      password: 'password'
    });
    console.log("STATUS:", res.status);
    console.log("BODY:", res.body);
  } catch (err) {
    console.error("ERR:", err);
  } finally {
    process.exit(0);
  }
}

test();
