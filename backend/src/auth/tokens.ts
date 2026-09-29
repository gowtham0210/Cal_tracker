import { SignJWT, jwtVerify } from "jose";
import { config } from "../config.js";

const key = new TextEncoder().encode(config.jwtSecret);
const ISSUER = "lighter-api";

export interface AccessToken {
  accessToken: string;
  expiresIn: number;
}

/** Signs a short, stateless access token for the user (HS256). */
export async function issueAccessToken(userId: string): Promise<AccessToken> {
  const accessToken = await new SignJWT()
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${config.accessTokenTtl}s`)
    .sign(key);
  return { accessToken, expiresIn: config.accessTokenTtl };
}

/** Returns the user id in a valid token. Throws if the token is invalid or expired. */
export async function verifyAccessToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, key, { issuer: ISSUER, algorithms: ["HS256"] });
  if (!payload.sub) throw new Error("Token has no subject");
  return payload.sub;
}
