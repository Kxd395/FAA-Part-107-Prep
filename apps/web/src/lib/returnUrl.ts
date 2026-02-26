const DEFAULT_RETURN_URL = "/";

export function sanitizeReturnUrl(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_RETURN_URL;

  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//")) return DEFAULT_RETURN_URL;

  try {
    const parsed = new URL(value, "http://localhost");
    if (parsed.origin !== "http://localhost") return DEFAULT_RETURN_URL;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_RETURN_URL;
  }
}
