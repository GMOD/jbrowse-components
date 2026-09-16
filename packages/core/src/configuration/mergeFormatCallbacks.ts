import { isPlainObject } from '../util/objectUtils.ts'

/**
 * Combine the tiers of an object-returning format callback (`formatDetails` on
 * the feature-details panel, `formatAbout` on the About dialog), earliest
 * first, so a track's object is spread over the session-wide one and can
 * override individual keys the global callback added.
 *
 * A tier that returns something other than an object is an authoring mistake,
 * `"jexl:feature.name"` where `"jexl:{name:feature.name}"` was meant, and it
 * throws rather than vanishing: spread, the string became rows keyed 0, 1, 2,
 * and dropped, the author's callback silently did nothing. A tier returning
 * null or undefined has nothing to add. `null` and `undefined` *values* survive:
 * they are how a callback hides a field, and the panels filter them downstream.
 */
export function mergeFormatCallbacks(...tiers: unknown[]) {
  const out: Record<string, unknown> = {}
  for (const tier of tiers) {
    if (tier == null) {
      continue
    }
    if (!isPlainObject(tier)) {
      throw new Error(
        `a format callback returned ${Array.isArray(tier) ? 'an array' : `a ${typeof tier}`} where an object of fields was expected, e.g. "jexl:{name:feature.name}" rather than "jexl:feature.name"`,
      )
    }
    Object.assign(out, tier)
  }
  return out
}
