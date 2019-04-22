export function calcStdFromSums(sum, sumSquares, n) {
  if (n === 0) return 0

  const variance = sumSquares / n - (sum * sum) / (n * n)
  return variance < 0 ? 0 : Math.sqrt(variance)
}

export function rectifyStats(s) {
  return {
    ...s,
    scoreMean: s.featureCount ? s.scoreSum / s.featureCount : 0,
    scoreStdDev: calcStdFromSums(s.scoreSum, s.scoreSumSquares, s.featureCount),
    featureDensity: s.featureCount / s.basesCovered,
  }
}
