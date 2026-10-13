import pg from "pg"
import bcrypt from "bcrypt"

const { Client } = pg

const client = new Client({
    connectionString:  "postgresql://postgres:relife@localhost:5432/izeon_books?schema=public",
})

const saltRounds = 10
const password = "Haaris1220$"

const hashedPassword = bcrypt.hashSync(password, saltRounds)

const credentials = {
    username:"Mohammed Haaris",
    email: "smhhaaris2020@gmail.com",
    password: hashedPassword,
    role:"ADMIN"
}

async function seedCredentialsData(){
    await client.connect(); 
    console.log("Connected to Postgresql")

    // Check if the user already exists
    const existingUser = await client.query(
        `SELECT * FROM "User" WHERE email = $1`,
        [credentials.email]
    )

    if(existingUser.rows.length > 0) {
        const updateQuery = await client.query(
            `UPDATE "User" SET "password" = $1, "username" = $2, "role" = $3, "updatedAt" = NOW() WHERE "email" = $4 RETURNING *`,
            [credentials.password, credentials.username, credentials.role, credentials.email]
        )
        console.log("✅ Credential Data Updated: ", updateQuery.rows[0])
    } else {
        const insertQuery = await client.query(
            `INSERT INTO "User" ("username", "email", "password", "role", "createdAt", "updatedAt") 
            VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING *`, 
            [credentials.username, credentials.email, credentials.password, credentials.role]
        )

         if(insertQuery.rows.length > 0) {
        console.log("✅ Credential Data Added: ",insertQuery.rows[0])
        } else {
        console.log("❌ No record Inserted")
        }
    }

   

    await client.end();
}


seedCredentialsData().catch((err) => {
    console.error("Send Error: ", err);
    process.exit(1)
})
    