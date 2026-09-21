import { isJexl, stringToJexlExpression } from './jexlStrings.ts'
import { buildJexlContext } from './simpleFeature.ts'

import type { JexlInstance } from './jexlStrings.ts'
import type { Feature } from './simpleFeature.ts'

/**
 * #api
 * What a channel reads off a feature: a field by name, a dotted path into a
 * structured field where no field carries the whole name (`INFO.SVTYPE` on a
 * VCF record), or a `jexl:` expression over `feature`. A jexl expression that
 * does not compile throws here, once, rather than on every feature.
 */
export function fieldReader(
  ref: string,
  jexl: JexlInstance | undefined,
): (feature: Feature) => unknown {
  const path = ref.includes('.') ? ref.split('.') : undefined
  const rests = path?.map((_, i) => path.slice(i).join('.'))
  if (isJexl(ref)) {
    if (!jexl) {
      throw new Error(`a jexl: field needs a jexl instance (${ref})`)
    }
    const expr = stringToJexlExpression(ref, jexl)
    return feature => expr.eval(buildJexlContext({ feature }))
  }
  return feature => {
    const value: unknown = feature.get(ref)
    return value === undefined && path && rests
      ? readPath(feature.get(path[0]!), path, rests)
      : value
  }
}

/**
 * #api
 * Whether a field ref is a bare name: what `feature.get` answers on its own,
 * with no path to walk and no expression to evaluate. A loop over a plain name
 * keeps the direct call, and only a config that writes a path pays for one.
 */
export function isPlainFieldRef(ref: string) {
  return !ref.includes('.') && !isJexl(ref)
}

function readPath(
  root: unknown,
  path: readonly string[],
  rests: readonly string[],
) {
  let value = root
  for (let i = 1; i < path.length; i++) {
    value =
      typeof value === 'object' && value !== null
        ? Reflect.get(value, path[i]!)
        : undefined
  }
  return value ?? readWholeRest(root, path, rests)
}

// A path that read nothing by descending tries each level's rest as one key,
// so `INFO.AF.EAS` reaches a key named `AF.EAS`, which VCF 4.3 allows. Only a
// miss pays for it: a path that resolves is the plain walk above.
function readWholeRest(
  root: unknown,
  path: readonly string[],
  rests: readonly string[],
) {
  let value = root
  for (let i = 1; i < path.length - 1; i++) {
    if (typeof value !== 'object' || value === null) {
      return undefined
    }
    const whole: unknown = Reflect.get(value, rests[i]!)
    if (whole !== undefined) {
      return whole ?? undefined
    }
    value = Reflect.get(value, path[i]!)
  }
  return undefined
}
