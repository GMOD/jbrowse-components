import { colord } from '@jbrowse/core/util/colord'

import { getMethBins } from '../../ModificationParser/getMethBins'

import type { ProcessedRenderArgs } from '../types'
import type { LayoutFeature } from '../util'
import type { Region } from '@jbrowse/core/util'

// Pre-compute colord objects for methylation colors
const RED_COLORD = colord('red')
const BLUE_COLORD = colord('blue')
const PINK_COLORD = colord('pink')
const PURPLE_COLORD = colord('purple')

// Color by methylation is slightly modified version of color by modifications
// at reference CpG sites, with non-methylated CpG colored (looking only at the
// MM tag can not tell you where reference CpG sites are)
export function renderMethylation({
  ctx,
  feat,
  region,
  bpPerPx,
  renderArgs,
  cigarOps,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  region: Region
  bpPerPx: number
  renderArgs: ProcessedRenderArgs
  cigarOps: ArrayLike<number>
}) {
  const { regionSequence } = renderArgs
  const { feature, topPx, heightPx } = feat
  if (!regionSequence) {
    throw new Error('region sequence required for methylation')
  }

  const seq = feature.get('seq') as string | undefined
  if (!seq) {
    return
  }
  const fstart = feature.get('start')
  const fend = feature.get('end')
  const { methBins, methProbs, hydroxyMethBins, hydroxyMethProbs } =
    getMethBins(feature, cigarOps)

  function getCol(k: number) {
    if (methBins[k]) {
      const p = methProbs[k] || 0
      return (
        p > 0.5 ? RED_COLORD.alpha((p - 0.5) * 2) : BLUE_COLORD.alpha(1 - p * 2)
      ).toHslString()
    }
    if (hydroxyMethBins[k]) {
      const p = hydroxyMethProbs[k] || 0
      return (
        p > 0.5
          ? PINK_COLORD.alpha((p - 0.5) * 2)
          : PURPLE_COLORD.alpha(1 - p * 2)
      ).toHslString()
    }
    return undefined
  }

  const regionStart = region.start
  const regionEnd = region.end
  const reversed = region.reversed
  const invBpPerPx = 1 / bpPerPx
  const r = regionSequence.toLowerCase()

  // Calculate visible range within feature
  const visStart = Math.max(0, regionStart - fstart)
  const visEnd = Math.min(fend - fstart, regionEnd - fstart)

  for (let i = visStart; i < visEnd; i++) {
    const j = i + fstart

    const l1 = r[j - regionStart + 1]
    const l2 = r[j - regionStart + 2]

    if (l1 === 'c' && l2 === 'g') {
      if (bpPerPx > 2) {
        const leftPx = reversed
          ? (regionEnd - j - 2) * invBpPerPx
          : (j - regionStart) * invBpPerPx
        const rightPx = reversed
          ? (regionEnd - j) * invBpPerPx
          : (j + 2 - regionStart) * invBpPerPx
        const w = rightPx - leftPx + 0.5
        ctx.fillStyle = getCol(i) || getCol(i + 1) || 'blue'
        ctx.fillRect(leftPx, topPx, w, heightPx)
      } else {
        const leftPx = reversed
          ? (regionEnd - j - 1) * invBpPerPx
          : (j - regionStart) * invBpPerPx
        const rightPx = reversed
          ? (regionEnd - j) * invBpPerPx
          : (j + 1 - regionStart) * invBpPerPx
        const w = rightPx - leftPx + 0.5
        ctx.fillStyle = getCol(i) || 'blue'
        ctx.fillRect(leftPx, topPx, w, heightPx)
        const leftPx2 = reversed
          ? (regionEnd - j - 2) * invBpPerPx
          : (j + 1 - regionStart) * invBpPerPx
        const rightPx2 = reversed
          ? (regionEnd - j - 1) * invBpPerPx
          : (j + 2 - regionStart) * invBpPerPx
        const w2 = rightPx2 - leftPx2 + 0.5
        ctx.fillStyle = getCol(i + 1) || 'blue'
        ctx.fillRect(leftPx2, topPx, w2, heightPx)
      }
    }
  }
}
