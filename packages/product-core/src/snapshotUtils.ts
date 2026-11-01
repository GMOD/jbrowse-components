/**
 * A session or config snapshot arrives as `unknown` at a loose walk — it is
 * `types.frozen` data, or a plain object read back off disk — so it is narrowed
 * by hand rather than by MST.
 */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
