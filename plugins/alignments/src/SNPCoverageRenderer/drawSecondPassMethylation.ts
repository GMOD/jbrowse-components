import { checkStopToken2, featureSpanPx } from '@jbrowse/core/util'

import { drawNoncovEvents } from './drawNoncovEvents.ts'
import { drawStackedBars } from './drawStackedBars.ts'

import type { SecondPassContext, SecondPassStats } from './types.ts'
import type { BaseCoverageBin } from '../shared/types.ts'

export function drawSecondPassMethylation(
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
  } = passCtx

  let snpDrawn = 0
  const snpSkipped = 0 // No skipping for the main methylation bars anymore

  let lastDrawnX = Number.NEGATIVE_INFINITY
  let prevTotal = 0

  for (let i = 0, l = coverageFeatures.length; i < l; i++) {
    checkStopToken2(lastCheck)
    const feature = coverageFeatures[i]!
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    const snpinfo = feature.get('snpinfo') as BaseCoverageBin
    const w = Math.max(rightPx - leftPx, 1)
    const score0 = feature.get('score') as number
    const drawX = Math.round(leftPx)
    const skipDraw = drawX === lastDrawnX

    // Minimal fix: always draw stacked bars, allowing overlap if drawX is the same
    const { depth, nonmods, mods } = snpinfo
    const h = toHeight(score0)
    const bottom = toY(score0) + h
    const curr = drawStackedBars(
      ctx,
      mods,
      colorMap,
      drawX,
      bottom,
      w,
      h,
      depth,
      0,
    )
    drawStackedBars(ctx, nonmods, colorMap, drawX, bottom, w, h, depth, curr)

    snpDrawn++ // Increment snpDrawn for each methylation bar drawn

    lastDrawnX = drawX // Update lastDrawnX always, for the next feature's skipDraw calculation

    drawNoncovEvents(
      passCtx,
      snpinfo,
      leftPx,
      score0,
      prevTotal,
      skipDraw, // drawNoncovEvents still receives skipDraw for its own internal logic
      feature.get('start'),
    )
    prevTotal = score0
  }

  return { snpDrawn, snpSkipped } // Return updated snpDrawn and 0 for snpSkipped
}
