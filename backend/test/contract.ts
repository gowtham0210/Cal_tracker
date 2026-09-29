import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

// Validates response bodies against the schemas in api/openapi.yaml.
const spec = parse(readFileSync(new URL("../../api/openapi.yaml", import.meta.url), "utf8"));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addFormat("password", true);
ajv.addSchema({ ...spec, $id: "openapi" });

const escape = (s: string) => s.replace(/~/g, "~0").replace(/\//g, "~1");

/** Asserts that `body` matches the documented response of `method path` with this status. */
export function assertMatchesSpec(method: string, path: string, status: number, body: unknown) {
  const op = spec.paths[path][method.toLowerCase()];
  let response = op.responses[String(status)];
  if (!response) throw new Error(`${method} ${path} does not document a ${status} response`);
  let pointer = `/paths/${escape(path)}/${method.toLowerCase()}/responses/${status}`;
  if (response.$ref) {
    pointer = response.$ref.slice(1);
    response = pointer.split("/").slice(1).reduce((o: any, k: string) => o[k.replace(/~1/g, "/").replace(/~0/g, "~")], spec);
  }
  const [mediaType] = Object.keys(response.content);
  const validate = ajv.getSchema(`openapi#${pointer}/content/${escape(mediaType)}/schema`)!;
  if (!validate(body)) throw new Error(`Response does not match the spec: ${ajv.errorsText(validate.errors)}\n${JSON.stringify(body)}`);
}
