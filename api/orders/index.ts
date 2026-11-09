import { randomUUID } from "node:crypto";
import { adminAuthConfigured, authenticateAdmin } from "../lib/auth";
import { database, toOrder, type OrderRow } from "../lib/database";
import {
  fail,
  methodNotAllowed,
  ok,
  optionalText,
  publicError,
  requestBody,
  requiredText,
} from "../lib/http";
import type { ApiRequest, ApiResponse } from "../lib/http";

const flavours = new Set([
  "Peri Peri",
  "Spicy Texan",
  "Sweet Moroccan",
]);

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === "GET") {
    if (!adminAuthConfigured()) {
      return fail(res, 503, "Admin access is not configured yet.");
    }
    if (!authenticateAdmin(req)) {
      return fail(res, 401, "Sign in to view orders.");
    }
    try {
      const sql = database();
      const rows = (await sql`
        SELECT id, customer_name, phone, item_name, unit_price_rand, deal_id,
          flavour, quantity, total_rand, notes, status, created_at
        FROM orders
        ORDER BY created_at DESC
        LIMIT 250
      `) as OrderRow[];
      return ok(res, { orders: rows.map(toOrder) });
    } catch (error) {
      return publicError(res, error);
    }
  }

  if (req.method !== "POST") return methodNotAllowed(res, ["GET", "POST"]);
  const body = requestBody(req.body);
  const customerName = requiredText(body?.customerName, 100);
  const phone = requiredText(body?.phone, 32);
  const flavour = requiredText(body?.flavour, 40);
  const notes = optionalText(body?.notes, 1000);
  const dealId = optionalText(body?.dealId, 100);
  const quantity = Number(body?.quantity);

  if (
    !customerName ||
    !phone ||
    !/^\+?[0-9()\s.-]{7,32}$/.test(phone) ||
    !flavour ||
    !flavours.has(flavour) ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 20 ||
    notes === undefined ||
    dealId === undefined
  ) {
    return fail(res, 400, "Check the order details and try again.");
  }

  try {
    const sql = database();
    const id = randomUUID();
    const rows = dealId
      ? ((await sql`
          INSERT INTO orders (
            id, customer_name, phone, item_name, unit_price_rand, deal_id,
            flavour, quantity, total_rand, notes, status
          )
          SELECT ${id}, ${customerName}, ${phone}, deals.title,
            deals.price_rand, deals.id, ${flavour}, ${quantity},
            deals.price_rand * ${quantity}, ${notes}, 'new'
          FROM deals
          WHERE deals.id = ${dealId}
            AND deals.active = TRUE
            AND (deals.starts_at IS NULL OR deals.starts_at <= NOW())
            AND (deals.ends_at IS NULL OR deals.ends_at >= NOW())
          RETURNING id, customer_name, phone, item_name, unit_price_rand,
            deal_id, flavour, quantity, total_rand, notes, status, created_at
        `) as OrderRow[])
      : ((await sql`
          INSERT INTO orders (
            id, customer_name, phone, item_name, unit_price_rand, deal_id,
            flavour, quantity, total_rand, notes, status
          )
          VALUES (
            ${id}, ${customerName}, ${phone}, 'Saturday Spread', 200, NULL,
            ${flavour}, ${quantity}, ${quantity * 200}, ${notes}, 'new'
          )
          RETURNING id, customer_name, phone, item_name, unit_price_rand,
            deal_id, flavour, quantity, total_rand, notes, status, created_at
        `) as OrderRow[]);
    if (!rows[0]) return fail(res, 409, "That deal is no longer available.");
    return ok(res, { order: toOrder(rows[0]) }, 201);
  } catch (error) {
    return publicError(res, error);
  }
}
