import { stringToJexlExpression } from '../util/jexlStrings.ts'
import { isFeature, jexlFeatureProxy } from '../util/simpleFeature.ts'

import type { JexlInstance } from '../util/jexlStrings.ts'

/**
 * Representation-independent versions of the value/callback logic that today
 * lives as methods on the per-slot MST model (`configurationSlot.ts`). These
 * operate on a bare `(value, type, defaultValue)` triple so the config editor
 * can drive a collapsed slot (a plain value-union property on the parent) with
 * no slot sub-model.
 *
 * Behavior is pinned to the slot-model methods by slotValueUtils.test.ts.
 */

export function isCallbackValue(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('jexl:')
}

/**
 * The single jexl-evaluation boundary for config values. Both the MST read path
 * (`readConfObject`) and the plain-object/worker read path (`readConfigValue`)
 * route through here, so the empty-body guard and compilation are defined once.
 *
 * An empty body (`'jexl:'`, e.g. mid-typing in the editor) has no compilable
 * code — return it literally instead of throwing (#4181).
 */
export function evaluateJexl(
  value: string,
  args: Record<string, unknown>,
  jexl?: JexlInstance,
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

const fallbackDefaults: Record<string, unknown> = {
  stringArray: [],
  stringArrayMap: {},
  numberMap: {},
  boolean: true,
  color: 'black',
  integer: 1,
  number: 1,
  string: '',
  text: '',
  fileLocation: { uri: '/path/to/resource.txt', locationType: 'UriLocation' },
  frozen: {},
}

/**
 * New value when converting a fixed-value slot to a jexl callback. Mirrors
 * `convertToCallback`. Already-callback values are returned unchanged.
 *
 * The old slot model routed this through a per-type `valueJSON` view (raw value
 * for number/boolean, JSON.stringify for everything else). That distinction was
 * dead weight: the only consumer is this string interpolation, and
 * `jexl:${42}` === `jexl:${JSON.stringify(42)}`. So one JSON.stringify covers
 * every type.
 */
export function toCallbackValue(value: unknown) {
  return isCallbackValue(value) ? value : `jexl:${JSON.stringify(value)}`
}

/**
 * New value when converting a jexl callback back to a fixed value. Mirrors
 * `convertToValue`: try evaluating with no args, else fall back to the slot
 * default (and to the hardcoded type default if that is itself a callback).
 */
export function toFixedValue(
  value: unknown,
  type: string,
  defaultValue: unknown,
  jexl?: JexlInstance,
) {
  if (!isCallbackValue(value)) {
    return value
  }
  try {
    const result = stringToJexlExpression(value, jexl).eval()
    if (result !== undefined) {
      return result
    }
  } catch {
    /* fall through to default */
  }
  if (isCallbackValue(defaultValue)) {
    if (!(type in fallbackDefaults)) {
      throw new Error(`no fallbackDefault defined for type ${type}`)
    }
    return fallbackDefaults[type]
  }
  return defaultValue
}
