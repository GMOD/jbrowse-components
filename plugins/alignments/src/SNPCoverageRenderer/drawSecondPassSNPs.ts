import { checkStopToken2, featureSpanPx } from '@jbrowse/core/util'

import { SNP_CLICKMAP_THRESHOLD } from './constants.ts'
import { drawNoncovEvents } from './drawNoncovEvents.ts'

import type { SecondPassContext, SecondPassStats } from './types.ts'
import type { BaseCoverageBin } from '../shared/types.ts'

export function drawSecondPassSNPs(
  passCtx: SecondPassContext,
): SecondPassStats {
  const {
    ctx,
    coverageFeatures,
    region,
    bpPerPx,
    colorMap,
    toY,
    toHeight,
    lastCheck,
    coords,
    items,
  } = passCtx

  let snpDrawn = 0
  let snpSkipped = 0
  let lastDrawnX = Number.NEGATIVE_INFINITY
  let lastDrawnDepth = -1
  let prevTotal = 0

  for (let i = 0, l = coverageFeatures.length; i < l; i++) {
    checkStopToken2(lastCheck)
    const feature = coverageFeatures[i]!
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    const snpinfo = feature.get('snpinfo') as BaseCoverageBin
    const w = Math.max(rightPx - leftPx, 1)
    const score0 = feature.get('score')
    const drawX = Math.round(leftPx)
    const skipDraw = drawX === lastDrawnX

    const { depth, snps, refbase } = snpinfo
    const refbaseUpper = refbase?.toUpperCase()
    const h = toHeight(score0)
    const bottom = toY(score0) + h
    let curr = 0

    for (const base in snps) {
      const entry = snps[base]!
      const { entryDepth } = entry
      const y1 = bottom - ((entryDepth + curr) / depth) * h
      const barHeight = (entryDepth / depth) * h
      const isSignificant = entryDepth / score0 >= SNP_CLICKMAP_THRESHOLD

      const sameDepthAtSameX = skipDraw && entryDepth === lastDrawnDepth
      if ((skipDraw && !isSignificant) || sameDepthAtSameX) {
        snpSkipped++
      } else {
        ctx.fillStyle = colorMap[base] || 'black'
        ctx.fillRect(drawX, y1, w, barHeight)
        snpDrawn++
        lastDrawnX = drawX
        lastDrawnDepth = entryDepth
      }

      if (isSignificant) {
        coords.push(drawX, y1, drawX + w, y1 + barHeight)
        items.push({
          type: 'snp',
          base,
          count: entryDepth,
          total: score0,
          refbase: refbaseUpper,
          avgQual: entry.avgProbability,
          fwdCount: entry['1'] || 0,
          revCount: entry['-1'] || 0,
          bin: snpinfo,
          start: feature.get('start'),
          end: feature.get('end'),
        })
      }
      curr += entryDepth
    }

    drawNoncovEvents(
      passCtx,
      snpinfo,
      leftPx,
      score0,
      prevTotal,
      skipDraw,
      feature.get('start'),
    )
    prevTotal = score0
  }

  return { snpDrawn, snpSkipped }
}
