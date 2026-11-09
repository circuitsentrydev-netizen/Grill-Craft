import { randomUUID } from "node:crypto";
import {
  adminAuthConfigured,
  authenticateAdmin,
  requireSameOrigin,
} from "../lib/auth";
import { database, toDeal, type DealRow } from "../lib/database";
import {
  fail,
  isoDate,
  methodNotAllowed,
  ok,
  optionalText,
  publicError,
  requestBody,
  requiredText,
} from "../lib/http";
import type { ApiRequest, ApiResponse } from "../lib/http";

function validImageUrl(value: string | null | undefined) {
  if (value === null || value === undefined) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === "GET") {
    try {
      const sql = database();
      const rows = (await sql`
        SELECT id, title, description, price_rand, original_price_rand,
          image_url, starts_at, ends_at, active, created_at
        FROM deals
        WHERE active = TRUE
          AND (starts_at IS NULL OR starts_at <= NOW())
          AND (ends_at IS NULL OR ends_at >= NOW())
        ORDER BY created_at DESC
        LIMIT 20
      `) as DealRow[];
      return ok(res, { deals: rows.map(toDeal) });
    } catch (error) {
      return publicError(res, error);
    }
  }

  if (req.method === "POST") {
    if (!requireSameOrigin(req, res)) return;
    if (!adminAuthConfigured()) {
      return fail(res, 503, "Admin access is not configured yet.");
    }
    if (!authenticateAdmin(req)) {
      return fail(res, 401, "Sign in to publish a deal.");
    }
    const body = requestBody(req.body);
    const title = requiredText(body?.title, 100);
    const description = requiredText(body?.description, 500);
    const priceRand = Number(body?.priceRand);
    const originalPriceRaw = body?.originalPriceRand;
    const originalPriceRand =
      originalPriceRaw === undefined ||
      originalPriceRaw === null ||
      originalPriceRaw === ""
        ? null
        : Number(originalPriceRaw);
    const imageUrl = validImageUrl(optionalText(body?.imageUrl, 2000));
    const startsAt = isoDate(body?.startsAt);
    const endsAt = isoDate(body?.endsAt);
    const active = body?.active === undefined ? true : body.active;

    if (
      !title ||
      !description ||
      !Number.isFinite(priceRand) ||
      priceRand <= 0 ||
      priceRand > 100000 ||
      (originalPriceRand !== null &&
        (!Number.isFinite(originalPriceRand) ||
          originalPriceRand <= priceRand ||
          originalPriceRand > 100000)) ||
      imageUrl === undefined ||
      startsAt === undefined ||
      endsAt === undefined ||
      (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) ||
      typeof active !== "boolean"
    ) {
      return fail(res, 400, "Check the deal details and try again.");
    }

    try {
      const sql = database();
      const rows = (await sql`
        INSERT INTO deals (
          id, title, description, price_rand, original_price_rand, image_url,
          starts_at, ends_at, active
        )
        VALUES (
          ${randomUUID()}, ${title}, ${description}, ${priceRand},
          ${originalPriceRand}, ${imageUrl}, ${startsAt}, ${endsAt}, ${active}
        )
        RETURNING id, title, description, price_rand, original_price_rand,
          image_url, starts_at, ends_at, active, created_at
      `) as DealRow[];
      return ok(res, { deal: toDeal(rows[0]) }, 201);
    } catch (error) {
      return publicError(res, error);
    }
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}
