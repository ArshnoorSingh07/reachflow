let csrfToken: string | null = null;
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  const method = options?.method?.toUpperCase() ?? "GET";
  try {
    response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      signal: options?.signal ?? AbortSignal.timeout(15000),
      headers: {
        ...(options?.body ? { "content-type": "application/json" } : {}),
        ...(!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken
          ? { "x-csrf-token": csrfToken }
          : {}),
        ...options?.headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(0, "Cannot reach the server. Please try again.");
  }
  if (!response.ok) {
    if (response.status === 401) {
      csrfToken = null;
      window.dispatchEvent(new Event("reachflow:unauthorized"));
    }
    let message =
      response.status === 401
        ? "Your session expired. Sign in again."
        : "The request could not be completed.";
    try {
      message = (await response.json()).error ?? message;
    } catch {}
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) {
    if (path.startsWith("/api/logout")) csrfToken = null;
    return undefined as T;
  }
  const data = await response.json();
  if (path === "/api/me") csrfToken = data.csrfToken ?? null;
  return data;
}
