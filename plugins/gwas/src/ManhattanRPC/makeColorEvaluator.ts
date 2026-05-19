import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'

import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// Resolves `color` (CSS literal or `jexl:...`) into a per-feature ABGR-packed
// uint32. Compiles the jexl expression once and reuses it across features.
// Literals short-circuit to a constant.
export function makeColorEvaluator(
  color: string,
  jexl?: JexlInstance,
): (feature: Feature) => number {
  if (color.startsWith('jexl:')) {
    const expr = stringToJexlExpression(color, jexl)
    return feature => cssColorToABGR(expr.eval({ feature }) as string)
  }
  const constant = cssColorToABGR(color)
  return () => constant
}
