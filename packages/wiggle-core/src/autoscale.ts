export interface FeatureArrays {
  featurePositions: Uint32Array
  featureScores: Float32Array
  featureMinScores: Float32Array
  featureMaxScores: Float32Array
  numFeatures: number
}

export interface Dataset {
  data: FeatureArrays
  visStart?: number
  visEnd?: number
}

export interface ScoreStats {
  scoreMin: number
  scoreMax: number
  scoreMean: number
  scoreStdDev: number
}

function computeStats(
  summaryScoreMode: string,
  datasets: Dataset[],
  filterVisible: boolean,
): ScoreStats | undefined {
  const useWhiskers = summaryScoreMode === 'whiskers'
  const useMin = summaryScoreMode === 'min'
  const useMax = summaryScoreMode === 'max'
  let min = Infinity
  let max = -Infinity
  let sum = 0
  let sumSq = 0
  let count = 0
  for (const { data, visStart, visEnd } of datasets) {
    for (let i = 0; i < data.numFeatures; i++) {
      if (filterVisible && visStart !== undefined && visEnd !== undefined) {
        const fStart = data.featurePositions[i * 2]!
        const fEnd = data.featurePositions[i * 2 + 1]!
        if (fEnd <= visStart || fStart >= visEnd) {
          continue
        }
      }
      if (useWhiskers) {
        min = Math.min(min, data.featureMinScores[i]!)
        max = Math.max(max, data.featureMaxScores[i]!)
      } else if (useMin) {
        const s = data.featureMinScores[i]!
        min = Math.min(min, s)
        max = Math.max(max, s)
      } else if (useMax) {
        const s = data.featureMaxScores[i]!
        min = Math.min(min, s)
        max = Math.max(max, s)
      } else {
        const s = data.featureScores[i]!
        min = Math.min(min, s)
        max = Math.max(max, s)
      }
      const avg = data.featureScores[i]!
      sum += avg
      sumSq += avg * avg
      count++
    }
  }
  if (count === 0 || !Number.isFinite(min) || !Number.isFinite(max)) {
    return undefined
  }
  const mean = sum / count
  const stdDev = Math.sqrt(Math.max(0, sumSq / count - mean * mean))
  return { scoreMin: min, scoreMax: max, scoreMean: mean, scoreStdDev: stdDev }
}

// Converts pre-computed score stats into a domain [min, max], applying
// std-dev expansion for 'localsd'/'globalsd' autoscale types. Use this
// when you compute stats yourself (e.g. from Float32Array depths in
// alignments coverage) rather than via computeAutoscaleDomain.
export function domainFromStats(
  stats: ScoreStats,
  autoscaleType: string,
  numStdDev: number,
): [number, number] {
  const isSd = autoscaleType === 'localsd' || autoscaleType === 'globalsd'
  if (isSd) {
    const { scoreMean, scoreStdDev, scoreMin } = stats
    return [
      scoreMin >= 0 ? 0 : scoreMean - numStdDev * scoreStdDev,
      scoreMean + numStdDev * scoreStdDev,
    ]
  }
  return [stats.scoreMin, stats.scoreMax]
}

export function computeAutoscaleDomain(
  autoscaleType: string,
  summaryScoreMode: string,
  numStdDev: number,
  visibleEntries: {
    data: FeatureArrays
    visStart: number
    visEnd: number
  }[],
  allEntries: { data: FeatureArrays }[],
): [number, number] | undefined {
  const isGlobal = autoscaleType === 'global' || autoscaleType === 'globalsd'
  const stats = isGlobal
    ? computeStats(summaryScoreMode, allEntries, false)
    : computeStats(summaryScoreMode, visibleEntries, true)
  if (!stats) {
    return undefined
  }
  return domainFromStats(stats, autoscaleType, numStdDev)
}
