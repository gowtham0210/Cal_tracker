import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

// Checks responses against api/openapi.yaml: the status must be documented for the
// operation, and the body must match the documented schema for its media type.
const spec = parse(readFileSync(new URL("../../api/openapi.yaml", import.meta.url), "utf8"));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addFormat("password", true);
ajv.addSchema({ ...spec, $id: "openapi" });

const escape = (s: string) => s.replace(/~/g, "~0").replace(/\//g, "~1");
const resolve = (ref: string) => ref.slice(2).split("/").reduce((o: any, k: string) => o[k.replace(/~1/g, "/").replace(/~0/g, "~")], spec);

const templates = Object.keys(spec.paths).map((t) => ({
  template: t,
  regex: new RegExp("^" + t.replace(/\{[^}]+\}/g, "[^/]+") + "$"),
  literal: !t.includes("{"),
}));

/** The spec path template for a concrete path, preferring literal matches (e.g. /me/data over /me/{x}). */
export function templateFor(path: string) {
  const hits = templates.filter((t) => t.regex.test(path)).sort((a, b) => Number(b.literal) - Number(a.literal));
  return hits[0]?.template;
}

export function assertMatchesSpec(method: string, path: string, status: number, contentType: string | null, body: unknown) {
  const template = path.startsWith("/") && spec.paths[path] ? path : templateFor(path);
  if (!template) throw new Error(`${method} ${path} is not in the spec`);
  const m = method.toLowerCase();
  const op = spec.paths[template][m];
  if (!op) throw new Error(`${method} ${template} is not in the spec`);
  let response = op.responses[String(status)];
  if (!response) throw new Error(`${method} ${template} returned ${status}, which the spec does not document (${Object.keys(op.responses)})`);
  let pointer = `/paths/${escape(template)}/${m}/responses/${status}`;
  if (response.$ref) {
    pointer = response.$ref.slice(1);
    response = resolve(response.$ref);
  }
  if (!response.content) {
    if (body !== undefined && body !== "") throw new Error(`${method} ${template} ${status} should have no body`);
    return;
  }
  const mediaType = contentType?.split(";")[0].trim() ?? "";
  if (!response.content[mediaType]) throw new Error(`${method} ${template} ${status} returned ${mediaType}; spec allows ${Object.keys(response.content)}`);
  if (!response.content[mediaType].schema) return;
  const validate = ajv.getSchema(`openapi#${pointer}/content/${escape(mediaType)}/schema`)!;
  if (!validate(body)) throw new Error(`${method} ${template} ${status} does not match the spec: ${ajv.errorsText(validate.errors)}\n${JSON.stringify(body).slice(0, 500)}`);
}
