// Acklam's inverse standard normal CDF (accurate to ~1e-9).
export function normalInverseCDF(p: number): number {
  const a1 = -3.969683028665376e1
  const a2 = 2.209460984245205e2
  const a3 = -2.759285104469687e2
  const a4 = 1.38357751867269e2
  const a5 = -3.066479806614716e1
  const a6 = 2.506628277459239
  const b1 = -5.447609879822406e1
  const b2 = 1.615858368580409e2
  const b3 = -1.556989798598866e2
  const b4 = 6.680131188771972e1
  const b5 = -1.328068155288572e1
  const c1 = -7.784894002430293e-3
  const c2 = -3.223964580411365e-1
  const c3 = -2.400758277161838
  const c4 = -2.549732539343734
  const c5 = 4.374664141464968
  const c6 = 2.938163982698783
  const d1 = 7.784695709041462e-3
  const d2 = 3.224671290700398e-1
  const d3 = 2.445134137142996
  const d4 = 3.754408661907416
  const pLow = 0.02425
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    )
  }
  if (p <= 1 - pLow) {
    const q = p - 0.5
    const r = q * q
    return (
      ((((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q) /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
    )
  }
  const q = Math.sqrt(-2 * Math.log(1 - p))
  return -(
    (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
    ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
  )
}

// χ²(df=1) critical at significance level p. Uses χ²(1) ≡ Z²: the critical is
// (Φ⁻¹(1 - p/2))². Matches df=1 table to 4 sig figs (p=0.05 → 3.841,
// p=0.01 → 6.635, p=0.001 → 10.83, p=0.0001 → 15.14).
export function getChiSquareCritical(pValue: number): number {
  if (pValue <= 0) {
    return Number.POSITIVE_INFINITY
  }
  if (pValue >= 1) {
    return 0
  }
  const z = normalInverseCDF(1 - pValue / 2)
  return z * z
}

// Hardy-Weinberg equilibrium χ²(df=1) goodness-of-fit test. Returns false when
// the variant deviates beyond the critical value (i.e. should be filtered out).
export function passesHweFilter(
  nHomRef: number,
  nHet: number,
  nHomAlt: number,
  nValid: number,
  chiSqCritical: number,
): boolean {
  const p = (2 * nHomRef + nHet) / (2 * nValid)
  const q = 1 - p
  const expectedHomRef = p * p * nValid
  const expectedHet = 2 * p * q * nValid
  const expectedHomAlt = q * q * nValid
  let chiSq = 0
  if (expectedHomRef > 0) {
    chiSq += (nHomRef - expectedHomRef) ** 2 / expectedHomRef
  }
  if (expectedHet > 0) {
    chiSq += (nHet - expectedHet) ** 2 / expectedHet
  }
  if (expectedHomAlt > 0) {
    chiSq += (nHomAlt - expectedHomAlt) ** 2 / expectedHomAlt
  }
  return chiSq <= chiSqCritical
}
