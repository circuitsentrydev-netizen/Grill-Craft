import { clearSessionCookie, requireSameOrigin } from "../lib/auth";
import { methodNotAllowed, ok } from "../lib/http";
import type { ApiRequest, ApiResponse } from "../lib/http";

export default function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!requireSameOrigin(req, res)) return;
  res.setHeader("Set-Cookie", clearSessionCookie());
  return ok(res, { success: true });
}
