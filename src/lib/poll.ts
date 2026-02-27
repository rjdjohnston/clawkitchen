/**
 * Polls until check returns a non-null value or timeout. Returns the value or null on timeout.
 */
export async function pollUntil<T>(
  check: () => Promise<T | null>,
  opts: { timeoutMs: number; intervalMs?: number }
): Promise<T | null> {
  const intervalMs = opts.intervalMs ?? 500;
  const started = Date.now();

  while (Date.now() - started < opts.timeoutMs) {
    const result = await check();
    if (result !== null) return result;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  return null;
}
