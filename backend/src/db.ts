import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
});

export default pool;
