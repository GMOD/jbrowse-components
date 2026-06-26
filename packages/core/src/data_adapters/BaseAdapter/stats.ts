import { max, min, sum } from '../../util/index.ts'
import { rectifyStats } from '../../util/stats.ts'

import type { RectifiedQuantitativeStats } from '../../util/stats.ts'

export function aggregateQuantitativeStats(
  stats: RectifiedQuantitativeStats[],
) {
  const meanMins = stats.map(s => s.scoreMeanMin).filter(s => s !== undefined)
  const meanMaxs = stats.map(s => s.scoreMeanMax).filter(s => s !== undefined)
  return rectifyStats({
    scoreMax: max(stats.map(s => s.scoreMax)),
    scoreMin: min(stats.map(s => s.scoreMin)),
    scoreSum: sum(stats.map(s => s.scoreSum)),
    scoreSumSquares: sum(stats.map(s => s.scoreSumSquares)),
    featureCount: sum(stats.map(s => s.featureCount ?? 0)),
    basesCovered: sum(stats.map(s => s.basesCovered)),
    ...(meanMins.length > 0 ? { scoreMeanMin: min(meanMins) } : {}),
    ...(meanMaxs.length > 0 ? { scoreMeanMax: max(meanMaxs) } : {}),
  })
}

export { blankStats } from '../../util/stats.ts'
