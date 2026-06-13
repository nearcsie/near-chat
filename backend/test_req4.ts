import request from 'supertest';
import { app } from './src/index';

async function test() {
  try {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'TestRun',
      email: 'testrun3@test.com',
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
