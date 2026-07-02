// Native per-value transforms mapping a GWAS feature's raw score column into
// the Manhattan plot y value (-log10 p). Deliberately native, not jexl:
// benchmarked at ~0.34M jexl evals/s vs ~390M/s native, and millions of SNPs
// flow through this path on a genome-wide view. Only the non-identity modes
// live here; `none` is absent so a lookup returns undefined and the adapter
// can skip wrapping the feature stream entirely (zero added cost).
const transforms: Record<string, (score: number) => number> = {
  // score column holds a raw p-value. GWAS summary stats routinely underflow to
  // an exact 0 (true p < ~1e-308); clamp to the smallest positive double so the
  // result stays finite (~323) rather than +Infinity, which would poison the
  // shared score domain and flatten every other point to the axis floor.
  negLog10: p => -Math.log10(Math.max(p, Number.MIN_VALUE)),
  // score column holds a natural-log p-value (e.g. Pan-UKBB Hail `ln P`).
  // Log-space input can't underflow the same way, so no clamp is needed.
  negLog10FromLn: lnp => -lnp / Math.LN10,
}

export function getScoreTransform(mode: string) {
  return transforms[mode]
}
