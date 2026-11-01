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
  try {
    response = await fetch(path, {
      ...options,
      signal: options?.signal ?? AbortSignal.timeout(15000),
      headers: {
        ...(options?.body ? { "content-type": "application/json" } : {}),
        ...options?.headers,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(
      0,
      "Cannot reach the server. Check your connection and try again.",
    );
  }
  if (!response.ok) {
    let message =
      response.status === 401
        ? "Your session expired. Please sign in again."
        : "Something went wrong. Please try again.";
    try {
      message = (await response.json()).error ?? message;
    } catch {}
    throw new ApiError(response.status, message);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
