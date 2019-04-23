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

/*
 * @param s - a summary stats object with scoreSum, featureCount, scoreSumSquares, and basesCovered
 * @return - a summary stats object with scoreMean, scoreStdDev, and featureDensity added
 */
export function rectifyStats(s) {
  return {
    ...s,
    scoreMean: s.featureCount ? s.scoreSum / s.featureCount : 0,
    scoreStdDev: calcStdFromSums(s.scoreSum, s.scoreSumSquares, s.featureCount),
    featureDensity: s.featureCount / s.basesCovered,
  }
}

/*
 * calculates per-base scores for variable width features over a region
 * @param region - object contains start, end
 * @param features - list of features with start, end, score
 * @return array of numeric scores
 */
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

/*
 * transform a list of scores to summary statistics
 * @param region - object with start, end
 * @param scores - array of score values
 * @return - object with scoreMax, scoreMin, scoreSum, scoreSumSquares, etc
 */
export function scoresToStats(region, scores) {
  const { start, end } = region
  const scoreMax = scores.reduce((acc, curr) => Math.max(acc, curr))
  const scoreMin = scores.reduce((acc, curr) => Math.min(acc, curr))
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
