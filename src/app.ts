import express, { Application, Request, Response } from "express";
import cors from "cors";

const app: Application = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.get("/health-check", (_req: Request, res: Response) => {
  res.send("Hello this is from express js");
});

export default app;