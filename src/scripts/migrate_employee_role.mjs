import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to run the employee role migration");
}

const client = new Client({ connectionString });

async function main() {
  try {
    await client.connect();
    await client.query(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'EMPLOYEE';`);
    console.log("EMPLOYEE role added to the Role enum (or already present).");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Employee role migration failed:", error);
  process.exitCode = 1;
});
