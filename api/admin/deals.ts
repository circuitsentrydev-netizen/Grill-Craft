import { adminAuthConfigured, authenticateAdmin } from "../lib/auth";
import { database, toDeal, type DealRow } from "../lib/database";
import {
  fail,
  methodNotAllowed,
  ok,
  publicError,
} from "../lib/http";
import type { ApiRequest, ApiResponse } from "../lib/http";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  if (!adminAuthConfigured()) {
    return fail(res, 503, "Admin access is not configured yet.");
  }
  if (!authenticateAdmin(req)) {
    return fail(res, 401, "Sign in to access admin deals.");
  }

  try {
    const sql = database();
    const rows = (await sql`
      SELECT id, title, description, price_rand, original_price_rand,
        image_url, starts_at, ends_at, active, created_at
      FROM deals
      ORDER BY created_at DESC
      LIMIT 100
    `) as DealRow[];
    return ok(res, { deals: rows.map(toDeal) });
  } catch (error) {
    return publicError(res, error);
  }
}
