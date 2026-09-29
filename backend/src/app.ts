import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { db } from "./db/index.js";
import { errorHandler, notFound } from "./http/problem.js";
import { currentUser } from "./middleware/current-user.js";
import { auth } from "./routes/auth.js";
import { weights } from "./routes/weights.js";

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (_req, res) => {
    db.prepare("SELECT 1").get();
    res.json({ ok: true });
  });

  const v1 = express.Router();
  v1.use("/auth", auth);
  app.use("/api/v1", v1);

  // Not yet migrated to the v1 contract (see api/README.md).
  app.use("/api/weights", currentUser, weights);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
