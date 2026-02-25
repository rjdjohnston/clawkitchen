/**
 * Fetches JSON and throws on !res.ok.
 * Use errorMessage(e) in catch blocks.
 */
export async function fetchJson<T = unknown>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts);
  const json = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json as T;
}

/**
 * Fetches JSON and returns result with status. Use when you need to handle specific
 * HTTP status codes (e.g. 409) differently from generic errors.
 */
export async function fetchJsonWithStatus<T = unknown>(
  url: string,
  opts?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const res = await fetch(url, opts);
  const json = (await res.json()) as { error?: string };
  if (res.ok) return { ok: true, data: json as T };
  return { ok: false, status: res.status, error: json.error ?? "Request failed" };
}
