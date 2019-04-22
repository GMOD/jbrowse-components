/*
 * calculate standard deviation using the 'shortcut method' that accepts
 * the sum and the sum squares of the elements
 *
 * @param sum - sum(i, 1..n)
 * @param sumSquares - sum(i^2, 1..n)
 * @param n - number of elements
 * @param population - boolean: use population instead of sample correction
 * @return the estimated std deviation
 */
export function calcStdFromSums(sum, sumSquares, n, population = false) {
  if (n === 0) return 0
  let variance
  if (population) {
    variance = sumSquares / n - (sum * sum) / (n * n)
  } else {
    // sample correction is n-1
    variance = sumSquares - (sum * sum) / n
    if (n > 1) {
      variance /= n - 1
    }
  }

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
      currentFeat += 1
    }
    const f = feats[currentFeat]
    // console.log('currentPos', pos, currentFeat)
    if (!f) {
      scores[i] = 0
    } else if (pos >= f.start && pos < f.end) {
      scores[i] = f.score
    } else {
      scores[i] = 0
    }
    i += 1
    pos += 1
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

export function summaryScoresToStats(region, feats) {
  const scoreMax = Math.max(...feats.map(s => s.scoreMax))
  const scoreMin = Math.min(...feats.map(s => s.scoreMin))
  const scoreSum = feats.map(s => s.scoreSum).reduce((a, b) => a + b, 0)
  const scoreSumSquares = feats
    .map(s => s.scoreSumSquares)
    .reduce((a, b) => a + b, 0)
  const featureCount = feats.map(s => s.featureCount).reduce((a, b) => a + b, 0)
  const basesCovered = feats.map(s => s.basesCovered).reduce((a, b) => a + b, 0)

  return rectifyStats({
    scoreMin,
    scoreMax,
    featureCount,
    basesCovered,
    scoreSumSquares,
    scoreSum,
  })
}
