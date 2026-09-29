import { AzureOpenAI } from "openai";
import type { z } from "zod";
import { HttpError } from "../http/problem.js";

/**
 * The only door to the model. Features call `json` or `stream`; this layer adds timeouts,
 * retries, output validation and one telemetry line per call, and hides the provider.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string | ContentPart[] };
export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export interface CallMeta {
  /** Feature and prompt version, e.g. "food-estimate@v1", for telemetry and evals. */
  prompt: string;
  userId?: string;
}

export interface Llm {
  /** Structured output: the model must follow `jsonSchema`; the result is re-checked with `schema`. */
  json<S extends z.ZodType>(req: { messages: ChatMessage[]; name: string; jsonSchema: object; schema: S; maxTokens: number; timeoutMs?: number }, meta: CallMeta): Promise<z.output<S>>;
  /** Free text, streamed as it is generated. */
  stream(req: { messages: ChatMessage[]; maxTokens: number; timeoutMs?: number; signal?: AbortSignal }, meta: CallMeta): AsyncIterable<string>;
}

export class AiUnavailable extends HttpError {
  constructor(detail: string) {
    super(503, "ai-unavailable", "AI features are unavailable right now. Please try again later.", detail);
  }
}

function log(meta: CallMeta, fields: Record<string, unknown>) {
  // Never log prompts, answers or user content; only what is needed to watch cost and health.
  console.log(JSON.stringify({ event: "llm_call", prompt: meta.prompt, ...fields }));
}

export class AzureLlm implements Llm {
  private client: AzureOpenAI;

  constructor(
    private cfg: { endpoint: string; apiKey: string; deployment: string; apiVersion: string },
    opts: { fetch?: typeof fetch; maxRetries?: number } = {},
  ) {
    // The SDK retries 429s and 5xx with backoff, honouring Retry-After.
    this.client = new AzureOpenAI({ ...cfg, maxRetries: opts.maxRetries ?? 2, fetch: opts.fetch });
  }

  async json<S extends z.ZodType>(req: Parameters<Llm["json"]>[0] & { schema: S }, meta: CallMeta): Promise<z.output<S>> {
    const started = Date.now();
    let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
    try {
      // One retry when the output parses but fails validation: models occasionally slip.
      for (let attempt = 1; ; attempt++) {
        const res = await this.client.chat.completions.create(
          {
            model: this.cfg.deployment,
            messages: req.messages as never,
            max_completion_tokens: req.maxTokens,
            response_format: { type: "json_schema", json_schema: { name: req.name, strict: true, schema: req.jsonSchema as Record<string, unknown> } },
          },
          { timeout: req.timeoutMs ?? 30_000 },
        );
        usage = res.usage ?? undefined;
        const choice = res.choices[0];
        if (choice?.finish_reason === "content_filter") throw new HttpError(400, "content-filtered", "That request can't be processed. Try rephrasing it.");
        const parsed = req.schema.safeParse(safeJson(choice?.message?.content));
        if (parsed.success) {
          log(meta, { ok: true, attempt, ms: Date.now() - started, in: usage?.prompt_tokens, out: usage?.completion_tokens });
          return parsed.data;
        }
        if (attempt >= 2) throw new AiUnavailable("The model returned output that failed validation.");
      }
    } catch (err) {
      log(meta, { ok: false, ms: Date.now() - started, error: errorName(err), in: usage?.prompt_tokens, out: usage?.completion_tokens });
      throw toHttpError(err);
    }
  }

  async *stream(req: Parameters<Llm["stream"]>[0], meta: CallMeta): AsyncIterable<string> {
    const started = Date.now();
    let out = 0;
    let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
    try {
      const stream = await this.client.chat.completions.create(
        {
          model: this.cfg.deployment,
          messages: req.messages as never,
          max_completion_tokens: req.maxTokens,
          stream: true,
          stream_options: { include_usage: true },
        },
        { timeout: req.timeoutMs ?? 60_000, signal: req.signal },
      );
      for await (const chunk of stream) {
        if (chunk.usage) usage = chunk.usage;
        const choice = chunk.choices[0];
        if (choice?.finish_reason === "content_filter") throw new HttpError(400, "content-filtered", "That request can't be processed. Try rephrasing it.");
        const delta = choice?.delta?.content;
        if (delta) {
          out += delta.length;
          yield delta;
        }
      }
      log(meta, { ok: true, ms: Date.now() - started, in: usage?.prompt_tokens, out: usage?.completion_tokens, chars: out });
    } catch (err) {
      log(meta, { ok: false, ms: Date.now() - started, error: errorName(err) });
      throw toHttpError(err);
    }
  }
}

function safeJson(s: string | null | undefined) {
  try {
    return s ? JSON.parse(s) : undefined;
  } catch {
    return undefined;
  }
}

const errorName = (err: unknown) => (err instanceof Error ? `${err.constructor.name}: ${err.message.slice(0, 120)}` : String(err));

function toHttpError(err: unknown) {
  if (err instanceof HttpError) return err;
  const status = (err as { status?: number })?.status;
  if (status === 429) return new AiUnavailable("The AI service is busy.");
  return new AiUnavailable("The AI service did not respond.");
}

/** Used when Azure is not configured: every call is a clean 503. */
export class DisabledLlm implements Llm {
  async json(): Promise<never> {
    throw new AiUnavailable("AI is not configured on this server. Set the AZURE_OPENAI_* variables.");
  }
  // eslint-disable-next-line require-yield
  async *stream(): AsyncIterable<string> {
    throw new AiUnavailable("AI is not configured on this server. Set the AZURE_OPENAI_* variables.");
  }
}

let current: Llm | undefined;

export function llm(): Llm {
  if (current) return current;
  const env = process.env;
  const cfg = {
    endpoint: env.AZURE_OPENAI_ENDPOINT ?? "",
    apiKey: env.AZURE_OPENAI_API_KEY ?? "",
    deployment: env.AZURE_OPENAI_DEPLOYMENT ?? "",
    apiVersion: env.AZURE_OPENAI_API_VERSION ?? env.AZURE_OPENAI__API_VERSION ?? "",
  };
  current = Object.values(cfg).every(Boolean) ? new AzureLlm(cfg) : new DisabledLlm();
  return current;
}

/** Swaps the model, e.g. for a fake in tests. */
export function setLlm(l: Llm | undefined) {
  current = l;
}
