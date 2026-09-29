import { iso } from "./dates.js";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  created_at: number;
}

/** Database row to the User schema in api/openapi.yaml. */
export const toUser = (u: UserRow) => ({ id: u.id, email: u.email, name: u.name, createdAt: iso(u.created_at) });
