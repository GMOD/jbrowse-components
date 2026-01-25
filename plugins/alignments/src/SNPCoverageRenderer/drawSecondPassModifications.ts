import { checkStopToken2, featureSpanPx } from '@jbrowse/core/util'

import { calculateModificationCounts } from './calculateModificationCounts.ts'
import { drawNoncovEvents } from './drawNoncovEvents.ts'
import { alphaColor } from '../shared/util.ts'

import type { SecondPassContext, SecondPassStats } from './types.ts'

export function drawSecondPassModifications(
  passCtx: SecondPassContext,
  visibleModifications: Record<
    string,
    { base: string; type: string; color?: string }
  >,
  isolatedModification: string | undefined,
  simplexSet: Set<string>,
): SecondPassStats {
  const {
    ctx,
    coverageFeatures,
    region,
    bpPerPx,
    toY,
    toHeight,
    stopTokenCheck,
  } = passCtx

  let snpDrawn = 0
  let snpSkipped = 0
  let lastDrawnX = Number.NEGATIVE_INFINITY
  let prevTotal = 0

  for (let i = 0, l = coverageFeatures.length; i < l; i++) {
    checkStopToken2(stopTokenCheck)
    const feature = coverageFeatures[i]!
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    const snpinfo = feature.get('snpinfo')
    const w = Math.max(rightPx - leftPx, 1)
    const score0 = feature.get('score')
    const drawX = Math.round(leftPx)
    const skipDraw = drawX === lastDrawnX

    let curr = 0
    const refbase = snpinfo?.refbase?.toUpperCase()
    const { nonmods, mods, snps, ref } = snpinfo || {}
    const h = toHeight(score0)
    const bottom = toY(score0) + h

    for (const key in nonmods) {
      const modKey = key.slice(7)
      const mod = visibleModifications[modKey]
      if (!mod || (isolatedModification && mod.type !== isolatedModification)) {
        continue
      }

      const { modifiable, detectable } = calculateModificationCounts({
        base: mod.base,
        isSimplex: simplexSet.has(mod.type),
        refbase,
        snps: snps || {},
        ref: ref || { entryDepth: 0, '1': 0, '-1': 0, '0': 0 },
        score0,
      })

      const { entryDepth, avgProbability = 0 } = nonmods[key]!
      const modFraction = (modifiable / score0) * (entryDepth / detectable)
      const barHeight = modFraction * h
      if (skipDraw) {
        snpSkipped++
      } else {
        ctx.fillStyle = alphaColor('blue', avgProbability)
        ctx.fillRect(drawX, bottom - (curr + barHeight), w, barHeight)
        snpDrawn++
        lastDrawnX = drawX
      }
      curr += barHeight
    }

    for (const key in mods) {
      const modKey = key.slice(4)
      const mod = visibleModifications[modKey]
      if (!mod || (isolatedModification && mod.type !== isolatedModification)) {
        continue
      }

      const { modifiable, detectable } = calculateModificationCounts({
        base: mod.base,
        isSimplex: simplexSet.has(mod.type),
        refbase,
        snps: snps || {},
        ref: ref || { entryDepth: 0, '1': 0, '-1': 0, '0': 0 },
        score0,
      })

      const { entryDepth, avgProbability = 0 } = mods[key]!
      const modFraction = (modifiable / score0) * (entryDepth / detectable)
      const barHeight = modFraction * h
      if (skipDraw) {
        snpSkipped++
      } else {
        ctx.fillStyle = alphaColor(mod.color || 'black', avgProbability)
        ctx.fillRect(drawX, bottom - (curr + barHeight), w, barHeight)
        snpDrawn++
        lastDrawnX = drawX
      }
      curr += barHeight
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
