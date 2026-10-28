import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:relife@localhost:5432/izeon_books?schema=public'
});

async function check() {
  await client.connect();
  try {
    const res = await client.query('SELECT enum_range(NULL::"Role");');
    console.log('Role enum values:', res.rows[0]);
  } catch (e) {
    console.log('Error checking Role enum:', e.message);
  }
  const userRoles = await client.query('SELECT DISTINCT role FROM "User";');
  console.log('Distinct user roles in DB:', userRoles.rows);
  await client.end();
}

check().catch(console.error);
