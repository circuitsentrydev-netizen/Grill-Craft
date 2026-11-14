import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { database } from "../lib/_database";
import type { ApiResponse } from "../lib/_http";

export const config = { api: { bodyParser: false } };

async function readRawBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function header(req: IncomingMessage, name: string) {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function verifySignature(raw: Buffer, req: IncomingMessage, secret: string) {
  const id = header(req, "webhook-id");
  const timestamp = header(req, "webhook-timestamp");
  const signature = header(req, "webhook-signature");
  if (!id || !timestamp || !signature) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 180) return false;
  const key = secret.startsWith("whsec_") ? Buffer.from(secret.slice(6), "base64") : Buffer.from(secret, "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${raw.toString("utf8")}`).digest("base64");
  return signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",", 2);
    if (version !== "v1" || !value) return false;
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

type YocoPaymentEvent = {
  id?: string;
  type?: string;
  payload?: {
    id?: string;
    amount?: number;
    currency?: string;
    status?: string;
    mode?: string;
    metadata?: { checkoutId?: string };
  };
};

export default async function handler(req: IncomingMessage, res: ApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const secret = process.env.YOCO_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: "Yoco webhook is not configured." });

  try {
    const raw = await readRawBody(req);
    if (!verifySignature(raw, req, secret)) {
      return res.status(401).json({ error: "Invalid webhook signature." });
    }

    const event = JSON.parse(raw.toString("utf8")) as YocoPaymentEvent;
    const eventId = header(req, "webhook-id");
    const checkoutId = event.payload?.metadata?.checkoutId;

    if (!eventId || !event.type || !event.payload) {
      return res.status(400).json({ error: "Invalid webhook event." });
    }
    if (event.type !== "payment.succeeded" && event.type !== "payment.failed") {
      return res.status(200).json({ received: true, ignored: true });
    }
    if (!checkoutId) {
      return res.status(400).json({ error: "Checkout reference is missing." });
    }

    const sql = database();
    const rows = (await sql`
      SELECT id, total_rand, yoco_checkout_id
      FROM orders
      WHERE yoco_checkout_id = ${checkoutId}
      LIMIT 1
    `) as { id: string; total_rand: number | string; yoco_checkout_id: string | null }[];
    const order = rows[0];

    if (!order || order.yoco_checkout_id !== checkoutId) {
      return res.status(200).json({ received: true, ignored: true });
    }

    if (event.type === "payment.succeeded") {
      if (event.payload.currency !== "ZAR") {
        return res.status(400).json({ error: "Currency mismatch." });
      }
      if (
        typeof event.payload.amount !== "number" ||
        event.payload.amount !== Math.round(Number(order.total_rand) * 100)
      ) {
        return res.status(400).json({ error: "Payment amount mismatch." });
      }
      if (event.payload.status && event.payload.status !== "succeeded") {
        return res.status(400).json({ error: "Payment status mismatch." });
      }
    }

    const inserted = (await sql`
      INSERT INTO payment_webhook_events (webhook_id, event_type)
      VALUES (${eventId}, ${event.type})
      ON CONFLICT (webhook_id) DO NOTHING
      RETURNING webhook_id
    `) as { webhook_id: string }[];

    if (inserted.length) {
      if (event.type === "payment.succeeded") {
        await sql`
          UPDATE orders
          SET payment_status = 'paid',
              payment_reference = ${event.payload.id || checkoutId},
              updated_at = NOW()
          WHERE id = ${order.id}
        `;
        await sql`
          INSERT INTO order_events (order_id, event_type, message)
          VALUES (${order.id}, 'payment_paid', 'Yoco payment confirmed')
        `;
      } else {
        await sql`
          UPDATE orders
          SET payment_status = 'failed', updated_at = NOW()
          WHERE id = ${order.id} AND payment_status <> 'paid'
        `;
        await sql`
          INSERT INTO order_events (order_id, event_type, message)
          VALUES (${order.id}, 'payment_failed', 'Yoco payment was not completed')
        `;
      }
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Yoco webhook processing failed", error);
    return res.status(500).json({ error: "Webhook processing failed." });
  }
}
