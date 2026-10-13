import { db } from "../prisma/db.js";

// Default courses list
const defaultCourses = [
  {
    title: "Data Analytics",
    code: "DA101",
    description: "Comprehensive Data Analytics program covering statistics, visualization, and big data tools.",
    durationWeeks: 12,
    baseFee: 50000,
  },
  {
    title: "Java Full Stack",
    code: "JFS201",
    description: "End‑to‑end Java development covering backend (Spring) and frontend (React) technologies.",
    durationWeeks: 16,
    baseFee: 75000,
  },
  {
    title: "Python Full Stack",
    code: "PFS301",
    description: "Full stack development using Python Django for backend and modern JS frameworks for frontend.",
    durationWeeks: 16,
    baseFee: 72000,
  },
  {
    title: "Network and Cyber Security",
    code: "NCS401",
    description: "In‑depth training on networking fundamentals and cybersecurity best practices.",
    durationWeeks: 14,
    baseFee: 60000,
  },
  {
    title: "Digital Marketing",
    code: "DM501",
    description: "Learn SEO, SEM, social media, content strategy, and analytics.",
    durationWeeks: 10,
    baseFee: 45000,
  },
  {
    title: "UI/UX Design",
    code: "UX601",
    description: "User Interface and Experience design principles, prototyping, and usability testing.",
    durationWeeks: 8,
    baseFee: 40000,
  },
];

async function seedCourses() {
  for (const c of defaultCourses) {
    await db.orm.public.Course.upsert({
      where: { code: c.code },
      create: {
        title: c.title,
        code: c.code,
        description: c.description,
        durationWeeks: c.durationWeeks,
        baseFee: c.baseFee,
      },
      update: {
        title: c.title,
        description: c.description,
        durationWeeks: c.durationWeeks,
        baseFee: c.baseFee,
      },
    });
  }
  console.log("✅ Default courses seeded.");
}

seedCourses()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error seeding courses:", err);
    process.exit(1);
  });
