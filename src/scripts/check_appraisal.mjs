import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:relife@localhost:5432/izeon_books?schema=public",
});

async function main() {
  await client.connect();
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Employee'");
  console.log("Current Employee columns:", res.rows.map(r => `${r.column_name} (${r.data_type})`));
  
  // Also check if EmployeeAppraisal table exists
  const appTable = await client.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'EmployeeAppraisal'");
  console.log("EmployeeAppraisal table exists:", appTable.rows.length > 0);

  await client.end();
}

main().catch(console.error);
