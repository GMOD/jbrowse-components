import { isJexl, stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'

import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// Native rather than jexl presets: jexl measured ~0.34M evals/s against
// ~390M/s native. A Map, because an object literal would resolve 'toString'.
const transforms = new Map<string, (score: number) => number>([
  // p underflows to an exact 0 in summary stats; the clamp keeps it finite
  ['negLog10', p => -Math.log10(Math.max(p, Number.MIN_VALUE))],
  ['negLog10FromLn', lnp => -lnp / Math.LN10],
])

// '' is a cleared slot
const IDENTITY_MODES = new Set(['none', ''])

// Undefined for an identity mode, which leaves the feature stream unwrapped.
export function getScoreTransform(mode: string, jexl?: JexlInstance) {
  if (jexl && isJexl(mode)) {
    const expr = stringToJexlExpression(mode, jexl)
    return (score: number) => Number(expr.eval({ score }))
  }
  const transform = transforms.get(mode)
  if (!transform && !IDENTITY_MODES.has(mode)) {
    console.warn(
      `GWAS scoreTransform ${JSON.stringify(mode)} is not recognized — ` +
        `scores are being plotted unchanged. Expected one of ${[
          ...IDENTITY_MODES,
          ...transforms.keys(),
        ]
          .filter(Boolean)
          .join(', ')}, or a "jexl:" expression of \`score\`.`,
    )
  }
  return transform
}
