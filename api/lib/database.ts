import { neon } from "@neondatabase/serverless";

let cachedSql: ReturnType<typeof neon> | undefined;

export function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    const error = new Error("DATABASE_NOT_CONFIGURED");
    throw error;
  }

  cachedSql ??= neon(connectionString);
  return cachedSql;
}

export interface OrderRow {
  id: string;
  customer_name: string;
  phone: string;
  item_name: string;
  unit_price_rand: number | string;
  deal_id: string | null;
  flavour: string;
  quantity: number;
  total_rand: number | string;
  notes: string | null;
  status: string;
  created_at: Date | string;
}

export interface DealRow {
  id: string;
  title: string;
  description: string;
  price_rand: number | string;
  original_price_rand: number | string | null;
  image_url: string | null;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
  active: boolean;
  created_at: Date | string;
}

export function toOrder(row: OrderRow) {
  return {
    id: row.id,
    customerName: row.customer_name,
    phone: row.phone,
    itemName: row.item_name,
    unitPriceRand: Number(row.unit_price_rand),
    dealId: row.deal_id,
    flavour: row.flavour,
    quantity: Number(row.quantity),
    totalRand: Number(row.total_rand),
    notes: row.notes,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function toDeal(row: DealRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priceRand: Number(row.price_rand),
    originalPriceRand:
      row.original_price_rand === null
        ? null
        : Number(row.original_price_rand),
    imageUrl: row.image_url,
    startsAt: row.starts_at ? new Date(row.starts_at).toISOString() : null,
    endsAt: row.ends_at ? new Date(row.ends_at).toISOString() : null,
    active: row.active,
    createdAt: new Date(row.created_at).toISOString(),
  };
}
