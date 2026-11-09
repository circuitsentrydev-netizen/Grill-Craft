# Grill Craft

Responsive Grill Craft website with customer order submission, an owner-only
admin page, persistent order statuses, and front-page deal publishing.

## Vercel deployment

The GitHub branch `replit/grill-craft-site` is a standalone Vite project. Import
that branch into Vercel with the repository root as the project root. It builds
with `npm run build` and publishes `dist`; `vercel.json` is already set up for
the single-page routes and Vercel API functions.

### Configure persistent data and admin access

1. Add a Neon Postgres database to the Vercel project (Vercel Marketplace).
2. Run `database/schema.sql` once in the database’s SQL editor.
3. Add these Vercel environment variables for Production and Preview:
   - `DATABASE_URL` — the Neon pooled connection string.
   - `ADMIN_EMAIL` — the owner email address authorized to sign in.
   - `ADMIN_PASSWORD` — a strong password for that one admin account.
   - `SESSION_SECRET` — a random secret at least 32 characters long.
4. Redeploy the site, then open `/admin`.

Keep those values in Vercel’s environment settings. Do not put real credentials
in this repository or in `VITE_` variables.

## Features

- Customers submit Saturday Spread orders with their name, phone, flavour,
  quantity, and optional notes.
- Orders are stored in Postgres and appear in `/admin`, where the owner can
  update order status.
- The owner can create, schedule, publish, and hide deals. Active deals appear
  on the front page, and can include an optional HTTPS image URL.
- Admin access is restricted server-side to the email in `ADMIN_EMAIL`.

The local Replit preview does not host Vercel serverless functions. API-backed
ordering and admin access become active after the Vercel database and variables
above are configured.
