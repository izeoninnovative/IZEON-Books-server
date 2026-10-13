import pg from "pg";
const { Client } = pg;

const client = new Client({
  connectionString: "postgresql://postgres:relife@localhost:5432/izeon_books?schema=public",
});

const courses = [
  {
    title: "Data Analytics",
    code: "DA-101",
    description: "Data Analytics, PowerBI, Tableau, SQL, Advanced Excel & Python",
    durationWeeks: 12,
    baseFee: 30000,
  },
  {
    title: "Java Full Stack",
    code: "JFS-201",
    description: "Core Java, Advanced Java, Spring Boot, Microservices, React & MySQL",
    durationWeeks: 16,
    baseFee: 35000,
  },
  {
    title: "Python Full Stack",
    code: "PFS-301",
    description: "Python, Django, FastAPI, React, REST API, Database Management",
    durationWeeks: 16,
    baseFee: 35000,
  },
  {
    title: "Network and Cyber Security",
    code: "NCS-401",
    description: "Ethical Hacking, Network Security, Penetration Testing, CISSP basics",
    durationWeeks: 14,
    baseFee: 32000,
  },
  {
    title: "Digital Marketing",
    code: "DM-501",
    description: "SEO, SEM, Social Media Marketing, Content Strategy, Google Ads & Analytics",
    durationWeeks: 10,
    baseFee: 25000,
  },
  {
    title: "UI/UX Design",
    code: "UIUX-601",
    description: "Figma, Adobe XD, Wireframing, Prototyping, Design Systems, UX Research",
    durationWeeks: 10,
    baseFee: 25000,
  },
];

async function seed() {
  await client.connect();
  console.log("Connected to PostgreSQL");

  for (const c of courses) {
    const existing = await client.query('SELECT * FROM "Course" WHERE "code" = $1 OR LOWER("title") = LOWER($2)', [c.code, c.title]);
    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO "Course" ("title", "code", "description", "durationWeeks", "baseFee", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [c.title, c.code, c.description, c.durationWeeks, c.baseFee]
      );
      console.log(`Added course: ${c.title}`);
    } else {
      console.log(`Course already exists: ${c.title}`);
    }
  }

  const allCourses = await client.query('SELECT id, title, code, "baseFee" FROM "Course"');
  console.log("All courses in DB:", allCourses.rows);

  await client.end();
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
