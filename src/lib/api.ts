export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new ApiError(
      "The order service is not available in this preview. Use the Vercel deployment after setup.",
      response.status || 503,
    );
  }
  const result = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & T;
  if (!response.ok) {
    throw new ApiError(
      result.error || "Something went wrong. Please try again.",
      response.status,
    );
  }
  return result;
}
