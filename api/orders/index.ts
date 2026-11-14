import { randomUUID } from "node:crypto";
import { adminAuthConfigured, authenticateAdmin } from "../lib/_auth";
import { database, toOrder, type OrderRow } from "../lib/_database";
import {
  fail,
  methodNotAllowed,
  ok,
  optionalText,
  publicError,
  requestBody,
  requiredText,
} from "../lib/_http";
import type { ApiRequest, ApiResponse } from "../lib/_http";

const flavours = new Set([
  "Mozambican Peri-Peri",
  "Moroccan",
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
  const sauceOption = body?.sauceOption === "smothered" ? "smothered" : "none";
  const itemType = body?.itemType === "whole_chicken" ? "whole_chicken" : "saturday_spread";
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
    const weekday = new Intl.DateTimeFormat("en-ZA", { weekday: "long", timeZone: "Africa/Johannesburg" }).format(new Date());
    if (!dealId && itemType === "saturday_spread" && weekday !== "Friday") {
      return fail(res, 409, "The Saturday Spread must be ordered on Friday.");
    }
    const rows = dealId
      ? ((await sql`
          INSERT INTO orders (
            id, customer_name, phone, item_name, unit_price_rand, deal_id,
            flavour, quantity, total_rand, notes, status, sauce_option
          )
          SELECT ${id}, ${customerName}, ${phone}, deals.title,
            deals.price_rand, deals.id, ${flavour}, ${quantity},
            deals.price_rand * ${quantity}, ${notes}, 'new', ${sauceOption}
          FROM deals
          WHERE deals.id = ${dealId}
            AND deals.active = TRUE
            AND (deals.starts_at IS NULL OR deals.starts_at <= NOW())
            AND (deals.ends_at IS NULL OR deals.ends_at >= NOW())
          RETURNING id, customer_name, phone, item_name, unit_price_rand,
            deal_id, flavour, quantity, total_rand, notes, status, created_at
        `) as OrderRow[])
      : itemType === "whole_chicken"
        ? ((await sql`
            INSERT INTO orders (
              id, customer_name, phone, item_name, unit_price_rand, deal_id,
              flavour, quantity, total_rand, notes, status, sauce_option
            )
            VALUES (
              ${id}, ${customerName}, ${phone}, 'Whole Chicken', 170, NULL,
              ${flavour}, ${quantity}, ${quantity * 170}, ${notes}, 'new', ${sauceOption}
            )
            RETURNING id, customer_name, phone, item_name, unit_price_rand,
              deal_id, flavour, quantity, total_rand, notes, status, created_at
          `) as OrderRow[])
        : ((await sql`
            INSERT INTO orders (
              id, customer_name, phone, item_name, unit_price_rand, deal_id,
              flavour, quantity, total_rand, notes, status, sauce_option
            )
            VALUES (
              ${id}, ${customerName}, ${phone}, 'Saturday Spread', 220, NULL,
              ${flavour}, ${quantity}, ${quantity * 220}, ${notes}, 'new', ${sauceOption}
            )
            RETURNING id, customer_name, phone, item_name, unit_price_rand,
              deal_id, flavour, quantity, total_rand, notes, status, created_at
          `) as OrderRow[]);
    if (!rows[0]) return fail(res, 409, "That deal is no longer available.");
    return ok(res, { order: { ...toOrder(rows[0]), sauceOption, paymentStatus: "pending" } }, 201);
  } catch (error) {
    return publicError(res, error);
  }
}
