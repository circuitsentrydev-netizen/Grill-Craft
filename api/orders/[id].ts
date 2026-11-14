import {
  adminAuthConfigured,
  authenticateAdmin,
  requireSameOrigin,
} from "../lib/_auth";
import { database, toOrder, type OrderRow } from "../lib/_database";
import {
  fail,
  methodNotAllowed,
  ok,
  publicError,
  requestBody,
} from "../lib/_http";
import type { ApiRequest, ApiResponse } from "../lib/_http";

const statuses = new Set([
  "new",
  "confirmed",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "PATCH") return methodNotAllowed(res, ["PATCH"]);
  if (!requireSameOrigin(req, res)) return;
  if (!adminAuthConfigured()) {
    return fail(res, 503, "Admin access is not configured yet.");
  }
  if (!authenticateAdmin(req)) {
    return fail(res, 401, "Sign in to update order status.");
  }

  const id = req.query?.id;
  const orderId = Array.isArray(id) ? id[0] : id;
  const body = requestBody(req.body);
  const status = body?.status;
  if (!orderId || typeof status !== "string" || !statuses.has(status)) {
    return fail(res, 400, "Choose a valid order status.");
  }

  try {
    const sql = database();
    const rows = (await sql`
      UPDATE orders
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${orderId}
      RETURNING id, customer_name, phone, item_name, unit_price_rand,
        deal_id, flavour, quantity, total_rand, notes, status, created_at
    `) as OrderRow[];
    if (!rows[0]) return fail(res, 404, "Order not found.");
    await sql`INSERT INTO order_events (order_id, event_type, message) VALUES (${orderId}, ${status}, ${'Order status updated to ' + status})`;
    return ok(res, { order: toOrder(rows[0]) });
  } catch (error) {
    return publicError(res, error);
  }
}
