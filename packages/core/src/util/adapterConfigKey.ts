/**
 * The adapter-config axis of a fetch key: the config a fetch was issued
 * against, as one string. Every fetch that refetches on an adapter edit folds
 * this in — the comparative displays, the prerequisite reads, the density
 * tier, the global family's signature — so the axis is spelled once and cannot
 * drift between them.
 *
 * Not `adapterConfigCacheKey`: that one short-circuits on `adapterId`, which is
 * right for sharing one adapter instance and wrong for freshness, where an
 * edit to a config carrying an id still has to read as a different fetch.
 */
export function adapterConfigKey(adapterConfig: Record<string, unknown>) {
  return JSON.stringify(adapterConfig)
}
