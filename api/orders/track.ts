import { database, type OrderRow } from "../lib/_database";
import { fail, methodNotAllowed, ok, publicError, requiredText } from "../lib/_http";
import type { ApiRequest, ApiResponse } from "../lib/_http";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  const id = requiredText(req.query?.id, 100);
  const phone = requiredText(req.query?.phone, 32);
  if (!id || !phone) return fail(res, 400, "Enter your order reference and phone number.");
  try {
    const sql = database();
    const rows = (await sql`
      SELECT id, customer_name, phone, item_name, unit_price_rand, deal_id,
        flavour, quantity, total_rand, notes, status, created_at,
        payment_status, sauce_option
      FROM orders WHERE id = ${id} AND phone = ${phone} LIMIT 1
    `) as (OrderRow & { payment_status: string; sauce_option: string })[];
    if (!rows[0]) return fail(res, 404, "We couldn't find an order with those details.");
    const events = await sql`
      SELECT event_type, message, created_at
      FROM order_events WHERE order_id = ${id}
      ORDER BY created_at ASC
    `;
    const order = rows[0];
    return ok(res, {
      order: {
        id: order.id,
        itemName: order.item_name,
        flavour: order.flavour,
        quantity: Number(order.quantity),
        totalRand: Number(order.total_rand),
        status: order.status,
        paymentStatus: order.payment_status,
        sauceOption: order.sauce_option,
        createdAt: new Date(order.created_at).toISOString(),
      },
      events,
    });
  } catch (error) {
    return publicError(res, error);
  }
}
