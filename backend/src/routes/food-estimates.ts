import express, { Router } from "express";
import { z } from "zod";
import { llm } from "../ai/llm.js";
import * as foodEstimate from "../ai/prompts/food-estimate.js";
import { HttpError } from "../http/problem.js";
import { body, parse } from "../http/validate.js";
import { aiRateLimit } from "./coach.js";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// Trust the bytes, not the Content-Type header.
function sniffImage(b: Buffer): string | undefined {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return undefined;
}

const textInput = body({ text: z.string("Text is required.").trim().min(1, "Describe what you ate.").max(1000, "Keep it under 1000 characters.") });

export const foodEstimates = Router();

foodEstimates.post(
  "/",
  aiRateLimit,
  express.raw({ type: IMAGE_TYPES, limit: MAX_IMAGE_BYTES }),
  async (req, res) => {
    const type = req.headers["content-type"]?.split(";")[0].trim().toLowerCase() ?? "";
    const meta = { prompt: foodEstimate.PROMPT, userId: res.locals.userId };

    let result;
    if (type === "application/json") {
      const { text } = parse(textInput, req.body);
      const out = await llm().json({ messages: foodEstimate.textMessages(text), name: "food_estimate", jsonSchema: foodEstimate.jsonSchema, schema: foodEstimate.schema, maxTokens: 1500 }, meta);
      result = { source: "ai-text", items: foodEstimate.finalize(out.items) };
    } else if (IMAGE_TYPES.includes(type)) {
      const bytes = req.body as Buffer;
      const actual = Buffer.isBuffer(bytes) ? sniffImage(bytes) : undefined;
      if (!actual) throw new HttpError(415, "unsupported-media-type", "Send a JPEG, PNG or WebP photo.");
      const dataUrl = `data:${actual};base64,${bytes.toString("base64")}`;
      const out = await llm().json(
        { messages: foodEstimate.photoMessages(dataUrl), name: "food_estimate", jsonSchema: foodEstimate.jsonSchema, schema: foodEstimate.schema, maxTokens: 1500, timeoutMs: 45_000 },
        { ...meta, prompt: `${foodEstimate.PROMPT}:photo` },
      );
      result = { source: "ai-photo", items: foodEstimate.finalize(out.items) };
    } else {
      throw new HttpError(415, "unsupported-media-type", "Send JSON with a text description, or a JPEG, PNG or WebP photo.");
    }
    res.json(result);
  },
);
