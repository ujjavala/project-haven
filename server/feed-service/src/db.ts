import { Pool } from 'pg';
const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432'),
  database: process.env.DB_NAME ?? 'haven_feeds',
  user: process.env.DB_USER ?? 'haven',
  password: process.env.DB_PASSWORD ?? 'haven',
});
export default pool;
