/**
 * Client for the Lighter API. Types mirror the schemas in api/openapi.yaml.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Session {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: User;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

/** An RFC 9457 problem returned by the API. */
export interface Problem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  errors?: { pointer: string; detail: string }[];
}

export class ApiError extends Error {
  constructor(readonly problem: Problem) {
    super(problem.detail ?? problem.title);
  }

  /** Field errors keyed by top-level field name, e.g. `{ email: "..." }`. Errors about the whole body use the key "". */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const e of this.problem.errors ?? []) {
      const field = e.pointer.split("/")[1] ?? "";
      out[field] ??= e.detail;
    }
    return out;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers: { "content-type": "application/json", ...init.headers } });
  } catch {
    throw new ApiError({ title: "Can't reach the server. Check your connection and try again.", status: 0 });
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(body?.title ? body : { title: "Something went wrong. Please try again.", status: res.status });
  return body as T;
}

export function register(input: RegisterRequest) {
  return request<Session>("/auth/register", { method: "POST", body: JSON.stringify(input) });
}
