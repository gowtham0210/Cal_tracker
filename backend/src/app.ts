import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { db } from "./db/index.js";
import { errorHandler, notFound } from "./http/problem.js";
import { requireAuth } from "./middleware/auth.js";
import { auth } from "./routes/auth.js";
import { journalEntries, measurementEntries, waterEntries, weightEntries } from "./routes/body.js";
import { coach } from "./routes/coach.js";
import { exerciseEntries } from "./routes/exercise.js";
import { exports } from "./routes/exports.js";
import { favoriteFoods, foodEntries } from "./routes/food.js";
import { foodEstimates } from "./routes/food-estimates.js";
import { insights } from "./routes/insights.js";
import { library } from "./routes/library.js";
import { me } from "./routes/me.js";
import { profile } from "./routes/profile.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", "loopback");
  app.use(cors({ origin: config.corsOrigin, exposedHeaders: ["Location", "Retry-After", "Content-Disposition"] }));
  app.use(express.json({ limit: "100kb", type: ["application/json", "application/merge-patch+json"] }));

  app.get("/api/health", (_req, res) => {
    db.prepare("SELECT 1").get();
    res.json({ ok: true });
  });

  const v1 = express.Router();
  v1.use("/auth", auth);

  // Everything below needs a bearer token.
  v1.use(requireAuth);
  v1.use("/me/profile", profile);
  v1.use("/me", me);
  v1.use("/food-entries", foodEntries);
  v1.use("/favorite-foods", favoriteFoods);
  v1.use("/weight-entries", weightEntries);
  v1.use("/measurement-entries", measurementEntries);
  v1.use("/exercise-entries", exerciseEntries);
  v1.use("/water-entries", waterEntries);
  v1.use("/journal-entries", journalEntries);
  v1.use("/food-estimates", foodEstimates);
  v1.use("/insights", insights);
  v1.use("/food-library", library);
  v1.use("/coach", coach);
  v1.use("/exports", exports);
  app.use("/api/v1", v1);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
