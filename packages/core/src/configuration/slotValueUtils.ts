import { isJexl, stringToJexlExpression } from '../util/jexlStrings.ts'
import { isFeature, jexlFeatureProxy } from '../util/simpleFeature.ts'

import type { JexlInstance } from '../util/jexlStrings.ts'

/**
 * The shared, MST-free jexl primitives for config values, with no knowledge of
 * slot type names. Both the MST read path (`readConfObject`) and the
 * plain-object/worker read path (`readConfigValue`) route through here.
 *
 * The value<->callback *conversions* (`toFixedValue`/`toCallbackValue`), which
 * depend on the slot-type registry, live in `configurationSlot.ts`.
 */

export function isCallbackValue(value: unknown): value is string {
  return isJexl(value)
}

/**
 * The single jexl-evaluation boundary for config values.
 *
 * An empty body (`'jexl:'`, e.g. mid-typing in the editor) has no compilable
 * code — return it literally instead of throwing (#4181).
 */
export function evaluateJexl(
  value: string,
  args: Record<string, unknown>,
  jexl: JexlInstance,
) {
  if (value.length <= 'jexl:'.length) {
    return value
  }
  // wrap a feature arg so callbacks can read `feature.score` directly, while
  // `get(feature,'score')` keeps working
  const context = isFeature(args.feature)
    ? { ...args, feature: jexlFeatureProxy(args.feature) }
    : args
  return stringToJexlExpression(value, jexl).eval(context)
}
