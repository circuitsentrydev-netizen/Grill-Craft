import { randomUUID } from "node:crypto";
import { adminAuthConfigured, authenticateAdmin, requireSameOrigin } from "../lib/_auth";
import { database, toOrder, type OrderRow } from "../lib/_database";
import { fail, methodNotAllowed, ok, optionalText, publicError, requestBody, requiredText } from "../lib/_http";
import type { ApiRequest, ApiResponse } from "../lib/_http";

const flavours = new Set(["Mozambican Peri-Peri", "Moroccan"]);
const paymentMethods = new Set(["cash", "eft", "whatsapp"]);

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!requireSameOrigin(req, res)) return;
  if (!adminAuthConfigured()) return fail(res, 503, "Admin access is not configured yet.");
  if (!authenticateAdmin(req)) return fail(res, 401, "Sign in to add an order.");

  const body = requestBody(req.body);
  const customerName = requiredText(body?.customerName, 100);
  const phone = requiredText(body?.phone, 32);
  const itemName = requiredText(body?.itemName, 100);
  const flavour = requiredText(body?.flavour, 40);
  const notes = optionalText(body?.notes, 1000);
  const quantity = Number(body?.quantity);
  const unitPrice = Number(body?.unitPriceRand);
  const paymentMethod = requiredText(body?.paymentMethod, 20);

  if (!customerName || !phone || !/^\+?[0-9()\s.-]{7,32}$/.test(phone) ||
      !itemName || !flavour || !flavours.has(flavour) ||
      !Number.isInteger(quantity) || quantity < 1 || quantity > 20 ||
      !Number.isFinite(unitPrice) || unitPrice <= 0 || unitPrice > 100000 ||
      notes === undefined || !paymentMethod || !paymentMethods.has(paymentMethod)) {
    return fail(res, 400, "Check the order details and try again.");
  }

  try {
    const sql = database();
    const id = randomUUID();
    const paymentStatus = paymentMethod === "cash" ? "cash_on_collection" : "pending";
    const rows = await sql`
      INSERT INTO orders (
        id, customer_name, phone, item_name, unit_price_rand, deal_id,
        flavour, quantity, total_rand, notes, status, sauce_option,
        payment_status, payment_provider, payment_reference
      )
      VALUES (
        ${id}, ${customerName}, ${phone}, ${itemName}, ${unitPrice}, NULL,
        ${flavour}, ${quantity}, ${unitPrice * quantity}, ${notes},
        'new', 'none', ${paymentStatus}, 'manual', ${paymentMethod}
      )
      RETURNING id, customer_name, phone, item_name, unit_price_rand,
        deal_id, flavour, quantity, total_rand, notes, status, created_at
    ` as OrderRow[];
    await sql`INSERT INTO order_events (order_id, event_type, message)
      VALUES (${id}, 'created', ${'Order added by admin (' + paymentMethod + ')'})`;
    return ok(res, { order: { ...toOrder(rows[0]), paymentStatus } }, 201);
  } catch (error) {
    return publicError(res, error);
  }
}
