import type { ErrorRequestHandler, RequestHandler, Response } from "express";
import type { z } from "zod";

// RFC 9457 problem details, matching the Problem schema in api/openapi.yaml.
const TYPE_BASE = "https://lighter.app/problems/";

export interface FieldError {
  pointer: string;
  detail: string;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: FieldError[];
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly slug: string,
    readonly title: string,
    readonly detail?: string,
    readonly errors?: FieldError[],
  ) {
    super(detail ?? title);
  }
}

export function sendProblem(res: Response, p: Problem) {
  res.status(p.status).type("application/problem+json").json(p);
}

/** Turns Zod issues into a 400 with one JSON Pointer per invalid field. */
export function validationError(error: z.ZodError): HttpError {
  const errors = error.issues.map((issue) => ({
    pointer: issue.path.map((k) => "/" + String(k).replace(/~/g, "~0").replace(/\//g, "~1")).join(""),
    detail: issue.message,
  }));
  return new HttpError(400, "validation-failed", "Your request is not valid.", undefined, errors);
}

export const notFound: RequestHandler = (req, res) => {
  sendProblem(res, { type: TYPE_BASE + "not-found", title: "Not found.", status: 404, detail: `No route for ${req.method} ${req.path}.` });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    sendProblem(res, { type: TYPE_BASE + err.slug, title: err.title, status: err.status, detail: err.detail, errors: err.errors });
    return;
  }
  // Errors raised by express.json() while reading the body.
  if (err?.type === "entity.parse.failed") {
    sendProblem(res, { type: TYPE_BASE + "malformed-json", title: "The request body is not valid JSON.", status: 400 });
    return;
  }
  if (err?.type === "entity.too.large") {
    sendProblem(res, { type: TYPE_BASE + "payload-too-large", title: "The request body is too large.", status: 413 });
    return;
  }
  console.error(err);
  sendProblem(res, { type: "about:blank", title: "Internal Server Error", status: 500 });
};
