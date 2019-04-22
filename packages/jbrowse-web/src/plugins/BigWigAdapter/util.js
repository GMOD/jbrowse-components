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

export function calcRealStats(region, features) {
  const { start, end } = region
  const scores = []
  const feats = features.sort((a, b) => a.start < b.start)
  let pos = start
  let currentFeat = 0
  let i = 0
  while (pos < end) {
    while (currentFeat < feats.length && pos >= feats[currentFeat].end) {
      // console.log(
      //   `currentPos ${pos}`,
      //   `currentFeat ${JSON.stringify(feats[currentFeat])}`,
      // )
      currentFeat++
    }
    const f = feats[currentFeat]
    // console.log('currentPos', pos, currentFeat)
    if (!f) {
      scores[i++] = 0
    } else if (pos >= f.start && pos < f.end) {
      scores[i++] = f.score
    } else {
      scores[i++] = 0
    }
    pos++
  }
  return scores
}
export function scoresToStats(region, scores) {
  const { start, end } = region
  const scoreMax = Math.max(...scores)
  const scoreMin = Math.min(...scores)
  const scoreSum = scores.reduce((a, b) => a + b, 0)
  const scoreSumSquares = scores.reduce((a, b) => a + b * b, 0)
  const featureCount = scores.length
  const basesCovered = end - start + 1

  return rectifyStats({
    scoreMax,
    scoreMin,
    scoreSum,
    scoreSumSquares,
    featureCount,
    basesCovered,
  })
}
