import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { db } from "./db/index.js";
import { currentUser } from "./middleware/current-user.js";
import { users } from "./routes/users.js";
import { weights } from "./routes/weights.js";

const app = express();
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  db.prepare("SELECT 1").get();
  res.json({ ok: true });
});

app.use("/api/users", users);
app.use("/api/weights", currentUser, weights);

app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
