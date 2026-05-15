export function normalizeScore(
  score: number,
  domainY: [number, number],
  scaleType: number,
): number {
  if (scaleType === 1) {
    const logMin = Math.log2(Math.max(domainY[0], 1))
    const logMax = Math.log2(Math.max(domainY[1], 1))
    return Math.max(
      0,
      Math.min(1, (Math.log2(Math.max(score, 1)) - logMin) / (logMax - logMin)),
    )
  }
  return Math.max(0, Math.min(1, (score - domainY[0]) / (domainY[1] - domainY[0])))
}
