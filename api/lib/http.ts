export interface ApiRequest {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string | undefined>;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
  end(): void;
}

export function methodNotAllowed(res: ApiResponse, allowed: string[]) {
  res.setHeader("Allow", allowed.join(", "));
  res.status(405).json({ error: "Method not allowed." });
}

export function fail(res: ApiResponse, status: number, message: string) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json({ error: message });
}

export function ok(res: ApiResponse, body: unknown, status = 200) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json(body);
}

export function requestBody(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as Record<string, unknown>;
}

export function requiredText(
  value: unknown,
  maxLength: number,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

export function optionalText(
  value: unknown,
  maxLength: number,
): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLength) return undefined;
  return trimmed;
}

export function isoDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function publicError(
  res: ApiResponse,
  error: unknown,
  fallback = "Something went wrong. Please try again.",
) {
  if (error instanceof Error) {
    console.error(error);
    if (error.message === "DATABASE_NOT_CONFIGURED") {
      fail(res, 503, "The order system is not configured yet.");
      return;
    }
  }
  fail(res, 500, fallback);
}
