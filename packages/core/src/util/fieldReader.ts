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
  if (isJexl(ref)) {
    if (!jexl) {
      throw new Error(`a jexl: field needs a jexl instance (${ref})`)
    }
    const expr = stringToJexlExpression(ref, jexl)
    return feature => expr.eval(buildJexlContext({ feature }))
  }
  return feature => {
    const value: unknown = feature.get(ref)
    return value === undefined && path
      ? readPath(feature.get(path[0]!), path)
      : value
  }
}

function readPath(root: unknown, path: readonly string[]) {
  let value = root
  for (let i = 1; i < path.length; i++) {
    value =
      typeof value === 'object' && value !== null
        ? Reflect.get(value, path[i]!)
        : undefined
  }
  return value ?? undefined
}
