// Format a number to `precision` significant figures, coercing the result back
// to a number so trailing zeros are dropped (5.000 -> 5, 0.8500 -> 0.85).
// Shared by the wiggle and GWAS tooltips so score/r² formatting stays uniform.
export function toP(s = 0, precision = 6) {
  return +s.toPrecision(precision)
}
