import { isObject } from '../util/objectUtils.ts'

/**
 * Combine the tiers of an object-returning format callback (`formatDetails` on
 * the feature-details panel, `formatAbout` on the About dialog), earliest
 * first, so a track's object is spread over the session-wide one and can
 * override individual keys the global callback added.
 *
 * A tier that isn't a plain object is dropped rather than spread. The classic
 * slip is `"jexl:feature.name"` where `"jexl:{name:feature.name}"` was meant;
 * spreading the resulting string produced attribute rows keyed `0`, `1`, `2`,
 * and an array does the same, which is why `isObject` alone isn't the gate.
 *
 * `null` and `undefined` *values* survive on purpose: they are how a callback
 * hides a field, and the panels filter them out downstream.
 */
export function mergeFormatCallbacks(...tiers: unknown[]) {
  const out: Record<string, unknown> = {}
  for (const tier of tiers) {
    if (isObject(tier) && !Array.isArray(tier)) {
      Object.assign(out, tier)
    }
  }
  return out
}
