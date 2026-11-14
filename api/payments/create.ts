import { database, type OrderRow } from "../lib/_database";
import { fail, methodNotAllowed, ok, publicError, requestBody, requiredText } from "../lib/_http";
import type { ApiRequest, ApiResponse } from "../lib/_http";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  const body = requestBody(req.body);
  const orderId = requiredText(body?.orderId, 100);
  if (!orderId) return fail(res, 400, "A valid order reference is required.");

  const secret = process.env.YOCO_SECRET_KEY;
  if (!secret) return fail(res, 503, "Online payments are not configured yet.");

  try {
    const sql = database();
    const rows = (await sql`
      SELECT id, customer_name, phone, item_name, unit_price_rand, deal_id,
        flavour, quantity, total_rand, notes, status, created_at
      FROM orders WHERE id = ${orderId} LIMIT 1
    `) as OrderRow[];
    const order = rows[0];
    if (!order) return fail(res, 404, "Order not found.");
    if (Number(order.total_rand) < 2) return fail(res, 400, "Yoco card payments start at R2.00.");

    const origin = `https://${req.headers.host}`;
    const checkoutResponse = await fetch("https://payments.yoco.com/api/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        "Idempotency-Key": orderId,
      },
      body: JSON.stringify({
        amount: Math.round(Number(order.total_rand) * 100),
        currency: "ZAR",
        clientReferenceId: orderId,
        externalId: orderId,
        metadata: { orderId },
        successUrl: `${origin}/track?order=${encodeURIComponent(orderId)}`,
        cancelUrl: `${origin}/track?order=${encodeURIComponent(orderId)}&payment=cancelled`,
        failureUrl: `${origin}/track?order=${encodeURIComponent(orderId)}&payment=failed`,
      }),
    });
    const checkout = await checkoutResponse.json() as { id?: string; redirectUrl?: string; message?: string };
    if (!checkoutResponse.ok || !checkout.id || !checkout.redirectUrl) {
      console.error("Yoco checkout creation failed", checkoutResponse.status);
      return fail(res, 502, "Yoco could not start checkout. Please try again.");
    }
    await sql`
      UPDATE orders SET yoco_checkout_id = ${checkout.id},
        payment_provider = 'yoco', updated_at = NOW()
      WHERE id = ${orderId}
    `;
    return ok(res, { checkoutUrl: checkout.redirectUrl, checkoutId: checkout.id });
  } catch (error) {
    return publicError(res, error, "Could not start payment. Please try again.");
  }
}
