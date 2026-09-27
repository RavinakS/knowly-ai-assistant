export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

export async function responseErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body !== "object" || body === null || !("message" in body)) {
    return fallback;
  }

  const message = body.message;
  if (typeof message === "string") {
    return message;
  }
  if (Array.isArray(message) && message.every((item) => typeof item === "string")) {
    return message.join(", ");
  }
  return fallback;
}
