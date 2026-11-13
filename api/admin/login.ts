import {
  requireSameOrigin,
  sessionCookie,
  verifyAdminCredentials,
} from "../lib/_auth";
import {
  fail,
  methodNotAllowed,
  ok,
  requestBody,
} from "../lib/_http";
import type { ApiRequest, ApiResponse } from "../lib/_http";

export default function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return methodNotAllowed(res, ["POST"]);
  if (!requireSameOrigin(req, res)) return;

  const body = requestBody(req.body);
  const result = verifyAdminCredentials(body?.email, body?.password);
  if (!result.configured) {
    return fail(res, 503, "Admin access is not configured yet.");
  }
  if (!result.valid || !result.email) {
    return fail(res, 401, "Email or password is incorrect.");
  }

  res.setHeader("Set-Cookie", sessionCookie(result.email));
  return ok(res, { admin: { email: result.email } });
}
