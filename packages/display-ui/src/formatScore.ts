// Only the fractional padding toPrecision adds is noise; guard on the decimal
// point because toPrecision can round UP out of the fractional form entirely —
// 99.95 comes back as "100", where an unguarded trailing-zero strip eats two
// significant digits and reports the score as 1.
export function formatScore(n: number) {
  if (n === 0) {
    return '0'
  }
  if (Math.abs(n) >= 100) {
    return n.toFixed(0)
  }
  const s = n.toPrecision(3)
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s
}
