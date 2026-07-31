import { isJexl, stringToJexlExpression } from '@jbrowse/core/util/jexlStrings'

import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// Native per-value transforms mapping a GWAS feature's raw score column into
// the Manhattan plot y value (-log10 p). Deliberately native, not jexl:
// benchmarked at ~0.34M jexl evals/s vs ~390M/s native, and millions of SNPs
// flow through this path on a genome-wide view. Only the non-identity modes
// live here; `none` is absent so a lookup returns undefined and the adapter
// can skip wrapping the feature stream entirely (zero added cost).
//
// A Map, not an object literal: `transforms[mode]` on an object literal also
// resolves Object.prototype members, so a `scoreTransform` of 'toString' /
// 'valueOf' / 'constructor' would hand back a prototype function and silently
// turn every score into garbage.
const transforms = new Map<string, (score: number) => number>([
  // score column holds a raw p-value. GWAS summary stats routinely underflow to
  // an exact 0 (true p < ~1e-308); clamp to the smallest positive double so the
  // result stays finite (~323) rather than +Infinity, which would poison the
  // shared score domain and flatten every other point to the axis floor.
  ['negLog10', p => -Math.log10(Math.max(p, Number.MIN_VALUE))],
  // score column holds a natural-log p-value (e.g. Pan-UKBB Hail `ln P`).
  // Log-space input can't underflow the same way, so no clamp is needed.
  ['negLog10FromLn', lnp => -lnp / Math.LN10],
])

// The identity modes: the column is already -log10, so no remapping. Empty
// string included because an explicitly-cleared slot reads back as ''.
const IDENTITY_MODES = new Set(['none', ''])

// Resolves the `scoreTransform` config into a per-value function, or undefined
// for the `none` fast path (adapter skips wrapping the stream entirely). A
// `jexl:...` expression is an arbitrary escape hatch — slower than the native
// modes, so opt-in only — evaluated with the raw column value bound to `score`
// (e.g. `jexl:-log10(score)`; note jexl's `log` is a console.log passthrough,
// not a math function, so use `log10`).
//
// Anything else is a misconfiguration (a typo'd mode, or a `jexl:` expression
// on an adapter with no jexl instance). It still falls back to the identity so
// the track loads, but silently doing so plots raw p-values on a -log10 axis —
// every point squashed into [0,1] with no hint why — so it warns.
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
