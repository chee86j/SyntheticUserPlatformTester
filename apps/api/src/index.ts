import { env } from "./config.js";
import cookieParser from "cookie-parser";
import express from "express";
import { authRouter } from "./routes/auth.js";
import { protectedRouter } from "./routes/protected.js";

const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", env.WEB_ORIGIN);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV
  });
});

app.use("/auth", authRouter);
app.use("/api", protectedRouter);

app.listen(env.API_PORT, () => {
  console.log(`API listening on http://localhost:${env.API_PORT}`);
});
