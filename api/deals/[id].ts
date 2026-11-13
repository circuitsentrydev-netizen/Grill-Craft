import {
  adminAuthConfigured,
  authenticateAdmin,
  requireSameOrigin,
} from "../lib/_auth";
import { database, toDeal, type DealRow } from "../lib/_database";
import {
  fail,
  methodNotAllowed,
  ok,
  publicError,
  requestBody,
} from "../lib/_http";
import type { ApiRequest, ApiResponse } from "../lib/_http";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "PATCH") return methodNotAllowed(res, ["PATCH"]);
  if (!requireSameOrigin(req, res)) return;
  if (!adminAuthConfigured()) {
    return fail(res, 503, "Admin access is not configured yet.");
  }
  if (!authenticateAdmin(req)) {
    return fail(res, 401, "Sign in to update a deal.");
  }

  const id = req.query?.id;
  const dealId = Array.isArray(id) ? id[0] : id;
  const body = requestBody(req.body);
  if (!dealId || typeof body?.active !== "boolean") {
    return fail(res, 400, "Choose whether the deal should be published.");
  }

  try {
    const sql = database();
    const rows = (await sql`
      UPDATE deals
      SET active = ${body.active}, updated_at = NOW()
      WHERE id = ${dealId}
      RETURNING id, title, description, price_rand, original_price_rand,
        image_url, starts_at, ends_at, active, created_at
    `) as DealRow[];
    if (!rows[0]) return fail(res, 404, "Deal not found.");
    return ok(res, { deal: toDeal(rows[0]) });
  } catch (error) {
    return publicError(res, error);
  }
}
