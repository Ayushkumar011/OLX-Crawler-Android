import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";

const app: Express = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5000",
  process.env.FRONTEND_URL
].filter(Boolean) as string[];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
