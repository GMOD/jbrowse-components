import { colord } from '@jbrowse/core/util/colord'

import { getMethBins } from '../../ModificationParser/getMethBins'

import type { FlatbushItem, ProcessedRenderArgs } from '../types'
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
  const items = [] as FlatbushItem[]
  const coords = [] as number[]
  const { regionSequence } = renderArgs
  const { feature, topPx, heightPx } = feat
  const bottomPx = topPx + heightPx
  if (!regionSequence) {
    throw new Error('region sequence required for methylation')
  }

  const seq = feature.get('seq') as string | undefined
  if (!seq) {
    return { items, coords }
  }
  const fstart = feature.get('start')
  const fend = feature.get('end')
  const { methBins, methProbs, hydroxyMethBins, hydroxyMethProbs } =
    getMethBins(feature, cigarOps)

  function getColAndProb(
    k: number,
  ): { color: string; prob: number; type: string } | undefined {
    if (methBins[k]) {
      const p = methProbs[k] || 0
      return {
        color: (p > 0.5
          ? RED_COLORD.alpha((p - 0.5) * 2)
          : BLUE_COLORD.alpha(1 - p * 2)
        ).toHslString(),
        prob: p,
        type: 'm (5mC)',
      }
    }
    if (hydroxyMethBins[k]) {
      const p = hydroxyMethProbs[k] || 0
      return {
        color: (p > 0.5
          ? PINK_COLORD.alpha((p - 0.5) * 2)
          : PURPLE_COLORD.alpha(1 - p * 2)
        ).toHslString(),
        prob: p,
        type: 'h (5hmC)',
      }
    }
    return undefined
  }

  const regionStart = region.start
  const regionEnd = region.end
  const reversed = region.reversed
  const invBpPerPx = 1 / bpPerPx
  const r = regionSequence.toLowerCase()

  function drawBase(
    start: number,
    end: number,
    info: { color: string; prob: number; type: string } | undefined,
    label: string,
  ) {
    const leftPx = reversed
      ? (regionEnd - end) * invBpPerPx
      : (start - regionStart) * invBpPerPx
    const rightPx = reversed
      ? (regionEnd - start) * invBpPerPx
      : (end - regionStart) * invBpPerPx
    const w = rightPx - leftPx + 0.5
    ctx.fillStyle = info?.color || 'blue'
    ctx.fillRect(leftPx, topPx, w, heightPx)

    if (rightPx - leftPx >= 0.2) {
      const prob = info?.prob ?? 0
      const modType = info?.type ?? 'unmethylated'
      items.push({
        type: 'modification',
        info: `${label} ${modType} (${(prob * 100).toFixed(1)}%)`,
        modType: 'methylation',
        probability: prob,
        start,
      })
      coords.push(leftPx, topPx, rightPx, bottomPx)
    }
  }

  // Calculate visible range within feature
  const visStart = Math.max(0, regionStart - fstart)
  const visEnd = Math.min(fend - fstart, regionEnd - fstart)

  for (let i = visStart; i < visEnd; i++) {
    const j = i + fstart

    const l1 = r[j - regionStart + 1]
    const l2 = r[j - regionStart + 2]

    if (l1 === 'c' && l2 === 'g') {
      const info1 = getColAndProb(i)
      const info2 = getColAndProb(i + 1)

      if (bpPerPx > 2) {
        drawBase(j, j + 2, info1 || info2, 'CpG')
      } else {
        drawBase(j, j + 1, info1, 'CpG C')
        drawBase(j + 1, j + 2, info2, 'CpG G')
      }
    }
  }

  return { items, coords }
}
