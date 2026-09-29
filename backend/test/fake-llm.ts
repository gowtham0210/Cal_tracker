import type { z } from "zod";
import { AiUnavailable, type CallMeta, type ChatMessage, type Llm } from "../src/ai/llm.js";

type JsonHandler = (messages: ChatMessage[]) => unknown;

/** A scriptable model for tests: records every call and returns canned output per prompt. */
export class FakeLlm implements Llm {
  calls: { prompt: string; messages: ChatMessage[] }[] = [];
  json_: Record<string, JsonHandler | Error> = {};
  chunks: string[] | Error = ["Hello"];

  async json<S extends z.ZodType>(req: { messages: ChatMessage[]; schema: S }, meta: CallMeta): Promise<z.output<S>> {
    const prompt = meta.prompt.split(":")[0];
    this.calls.push({ prompt: meta.prompt, messages: req.messages });
    const h = this.json_[prompt];
    if (!h) throw new AiUnavailable(`no fake for ${prompt}`);
    if (h instanceof Error) throw h;
    return req.schema.parse(h(req.messages));
  }

  async *stream(req: { messages: ChatMessage[] }, meta: CallMeta): AsyncIterable<string> {
    this.calls.push({ prompt: meta.prompt, messages: req.messages });
    if (this.chunks instanceof Error) throw this.chunks;
    for (const c of this.chunks) yield c;
  }

  last(prompt: string) {
    return [...this.calls].reverse().find((c) => c.prompt.startsWith(prompt));
  }
}

export const text = (m: ChatMessage) => (typeof m.content === "string" ? m.content : m.content.map((p) => (p.type === "text" ? p.text : p.image_url.url)).join("\n"));
