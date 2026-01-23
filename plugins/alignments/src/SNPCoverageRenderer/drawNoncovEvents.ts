import {
  INTERBASE_DRAW_THRESHOLD,
  INTERBASE_INDICATOR_HEIGHT,
  INTERBASE_INDICATOR_WIDTH,
  MINIMUM_INTERBASE_INDICATOR_READ_DEPTH,
} from './constants.ts'
import { createInterbaseItem } from './createInterbaseItem.ts'

import type { SecondPassContext } from './types.ts'
import type { BaseCoverageBin } from '../shared/types.ts'

export function drawNoncovEvents(
  passCtx: SecondPassContext,
  snpinfo: BaseCoverageBin,
  leftPx: number,
  score0: number,
  prevTotal: number,
  skipDraw: boolean,
  fstart: number,
) {
  const {
    ctx,
    colorMap,
    toHeight2,
    extraHorizontallyFlippedOffset,
    coords,
    items,
    bpPerPx,
    indicatorThreshold,
    showInterbaseCounts,
    showInterbaseIndicators,
  } = passCtx

  let totalCount = 0
  let maxDepth = 0
  let maxBase = ''
  let totalHeight = 0
  const r = 0.6
  const x = leftPx - r + extraHorizontallyFlippedOffset

  for (const base in snpinfo.noncov) {
    const { entryDepth } = snpinfo.noncov[base]!
    totalCount += entryDepth
    if (entryDepth > maxDepth) {
      maxDepth = entryDepth
      maxBase = base
    }
  }

  // allow significant interbase signals to be drawn even when skipDraw is true
  // (similar to SNP drawing logic)
  const isSignificant =
    score0 > 0 && totalCount > score0 * INTERBASE_DRAW_THRESHOLD
  const showCounts = showInterbaseCounts && (!skipDraw || isSignificant)

  if (showCounts) {
    for (const base in snpinfo.noncov) {
      const { entryDepth } = snpinfo.noncov[base]!
      const barHeight = toHeight2(entryDepth)
      ctx.fillStyle = colorMap[base]!
      ctx.fillRect(
        x,
        INTERBASE_INDICATOR_HEIGHT + totalHeight,
        r * 2,
        barHeight,
      )
      totalHeight += barHeight
    }
  }

  if (totalCount > 0) {
    const maxEntry = snpinfo.noncov[maxBase]

    if (showCounts) {
      if (bpPerPx < 50 || isSignificant) {
        const clickWidth = Math.max(r * 2, 2)
        coords.push(
          x,
          INTERBASE_INDICATOR_HEIGHT,
          x + clickWidth,
          INTERBASE_INDICATOR_HEIGHT + totalHeight,
        )
        items.push(
          createInterbaseItem(maxBase, totalCount, score0, fstart, maxEntry),
        )
      }
    }

    if (showInterbaseIndicators && (!skipDraw || isSignificant)) {
      const indicatorComparatorScore = Math.max(score0, prevTotal)
      if (
        totalCount > indicatorComparatorScore * indicatorThreshold &&
        indicatorComparatorScore > MINIMUM_INTERBASE_INDICATOR_READ_DEPTH
      ) {
        ctx.fillStyle = colorMap[maxBase]!
        ctx.beginPath()
        const l = leftPx + extraHorizontallyFlippedOffset
        ctx.moveTo(l - INTERBASE_INDICATOR_WIDTH / 2, 0)
        ctx.lineTo(l + INTERBASE_INDICATOR_WIDTH / 2, 0)
        ctx.lineTo(l, INTERBASE_INDICATOR_HEIGHT)
        ctx.fill()

        const hitboxPadding = 1
        coords.push(
          l - INTERBASE_INDICATOR_WIDTH / 2 - hitboxPadding,
          0,
          l + INTERBASE_INDICATOR_WIDTH / 2 + hitboxPadding,
          INTERBASE_INDICATOR_HEIGHT + hitboxPadding,
        )
        items.push(
          createInterbaseItem(
            maxBase,
            totalCount,
            indicatorComparatorScore,
            fstart,
            maxEntry,
          ),
        )
      }
    }
  }
}
