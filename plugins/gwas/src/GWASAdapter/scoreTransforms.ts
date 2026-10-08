import { isJexl, stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'

import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// Native rather than jexl presets: jexl measured ~0.34M evals/s against
// ~390M/s native. A Map, because an object literal would resolve 'toString'.
export const SCORE_TRANSFORMS = new Map<
  string,
  { label: string; apply?: (score: number) => number }
>([
  ['none', { label: 'None — column is already -log10(p)' }],
  [
    'negLog10',
    {
      label: '-log10 — column is a raw p-value',
      // p underflows to an exact 0 in summary stats; the clamp keeps it finite
      apply: p => -Math.log10(Math.max(p, Number.MIN_VALUE)),
    },
  ],
  [
    'negLog10FromLn',
    {
      label: '-log10 from ln — column is a natural-log p-value',
      apply: lnp => -lnp / Math.LN10,
    },
  ],
])

// Undefined for an identity mode, which leaves the feature stream unwrapped.
export function getScoreTransform(mode: string, jexl?: JexlInstance) {
  if (jexl && isJexl(mode)) {
    const expr = stringToJexlExpression(mode, jexl)
    return (score: number) => Number(expr.eval({ score }))
  }
  const preset = SCORE_TRANSFORMS.get(mode)
  // '' is a cleared slot
  if (!preset && mode !== '') {
    console.warn(
      `GWAS scoreTransform ${JSON.stringify(mode)} is not recognized — ` +
        `scores are being plotted unchanged. Expected one of ${[
          ...SCORE_TRANSFORMS.keys(),
        ].join(', ')}, or a "jexl:" expression of \`score\`.`,
    )
  }
  return preset?.apply
}
