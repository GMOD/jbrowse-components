import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { isJexl, stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'

import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// Fallback when a jexl `color` expression yields a non-string (undefined, a
// number, a typo'd branch): render the default point color rather than a fully
// transparent (0) point. An invisible point is indistinguishable from a render
// failure — a visible default surfaces the misconfiguration instead. Mirrors
// the `color` slot default in configSchemaFactory.
const FALLBACK_COLOR = cssColorToABGR('#0068d1')

// Resolves `color` (CSS literal or `jexl:...`) into a per-feature ABGR-packed
// uint32. Compiles the jexl expression once and reuses it across features.
// Literals short-circuit to a constant.
export function makeColorEvaluator(
  color: string,
  jexl: JexlInstance,
): (feature: Feature) => number {
  if (isJexl(color)) {
    const expr = stringToJexlExpression(color, jexl)
    return feature => {
      const v = expr.eval({ feature })
      return typeof v === 'string' ? cssColorToABGR(v) : FALLBACK_COLOR
    }
  }
  const constant = cssColorToABGR(color)
  return () => constant
}
