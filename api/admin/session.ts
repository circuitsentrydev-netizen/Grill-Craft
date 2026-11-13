import { adminAuthConfigured, authenticateAdmin } from "../lib/_auth";
import { fail, methodNotAllowed, ok } from "../lib/_http";
import type { ApiRequest, ApiResponse } from "../lib/_http";

export default function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") return methodNotAllowed(res, ["GET"]);
  if (!adminAuthConfigured()) {
    return fail(res, 503, "Admin access is not configured yet.");
  }
  const admin = authenticateAdmin(req);
  if (!admin) return fail(res, 401, "Sign in to access the admin page.");
  return ok(res, { admin: { email: admin.email } });
}
