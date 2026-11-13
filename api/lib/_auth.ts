import { createHmac, timingSafeEqual } from "node:crypto";
import type { ApiRequest, ApiResponse } from "./_http";
import { fail } from "./_http";

const COOKIE_NAME = "gc_admin_session";
const SESSION_SECONDS = 60 * 60 * 8;

export interface AdminSession {
  email: string;
  expiresAt: number;
}

function adminCredentials() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!email || !password || !secret || secret.length < 32) return null;
  return { email, password, secret };
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function cookieValue(req: ApiRequest, name: string): string | null {
  const parsed = req.cookies?.[name];
  if (parsed) return parsed;
  const header = req.headers.cookie;
  if (typeof header !== "string") return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function sessionCookie(email: string) {
  const config = adminCredentials();
  if (!config) throw new Error("ADMIN_AUTH_NOT_CONFIGURED");
  const payload = Buffer.from(
    JSON.stringify({
      email,
      expiresAt: Date.now() + SESSION_SECONDS * 1000,
    } satisfies AdminSession),
  ).toString("base64url");
  const signed = `${payload}.${signature(payload, config.secret)}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function adminAuthConfigured() {
  return adminCredentials() !== null;
}

export function authenticateAdmin(req: ApiRequest): AdminSession | null {
  const config = adminCredentials();
  if (!config) return null;

  const value = cookieValue(req, COOKIE_NAME);
  if (!value) return null;
  const [payload, receivedSignature] = value.split(".");
  if (!payload || !receivedSignature) return null;

  const expectedSignature = signature(payload, config.secret);
  if (!safeEqual(receivedSignature, expectedSignature)) return null;

  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as AdminSession;
    if (
      typeof session.email !== "string" ||
      session.email.toLowerCase() !== config.email ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Date.now()
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function verifyAdminCredentials(email: unknown, password: unknown) {
  const config = adminCredentials();
  if (!config) return { configured: false as const };
  if (typeof email !== "string" || typeof password !== "string") {
    return { configured: true as const, valid: false };
  }
  const emailMatches = safeEqual(email.trim().toLowerCase(), config.email);
  const passwordMatches = safeEqual(password, config.password);
  return {
    configured: true as const,
    valid: emailMatches && passwordMatches,
    email: config.email,
  };
}

export function requireSameOrigin(req: ApiRequest, res: ApiResponse) {
  const origin = req.headers.origin;
  if (typeof origin !== "string") return true;
  const host = req.headers.host;
  if (typeof host !== "string") {
    fail(res, 403, "Request origin could not be verified.");
    return false;
  }
  try {
    if (new URL(origin).host === host) return true;
  } catch {
    // Fall through to the same-origin rejection.
  }
  fail(res, 403, "Cross-origin requests are not allowed.");
  return false;
}
