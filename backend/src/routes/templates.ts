import { Router } from "express";
import { z } from "zod";
import { body, parse, text, uuid } from "../http/validate.js";
import { deleteTemplate, listTemplates, saveTemplate } from "../lib/templates.js";
import { monday } from "./plans.js";

export const templates = Router();

templates.get("/", (_req, res) => {
  res.json({ data: listTemplates(res.locals.userId) });
});

templates.post("/", (req, res) => {
  const { name, weekStart } = parse(body({ name: text(60, "Name"), weekStart: monday }), req.body);
  const t = saveTemplate(res.locals.userId, name, weekStart);
  res.status(201).location(`${req.baseUrl}/${t.id}`).json(t);
});

templates.delete("/:templateId", (req, res) => {
  const { templateId } = parse(z.object({ templateId: uuid }), req.params);
  deleteTemplate(res.locals.userId, templateId);
  res.status(204).end();
});
