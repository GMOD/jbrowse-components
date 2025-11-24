import { bpSpanPx } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'

import { getMethBins } from '../../ModificationParser/getMethBins'
import { fillRectCtx } from '../util'

import type { ProcessedRenderArgs } from '../types'
import type { LayoutFeature } from '../util'
import type { Region } from '@jbrowse/core/util'

// Pre-compute color objects for methylation rendering
const RED_COLORD = colord('red')
const BLUE_COLORD = colord('blue')
const PINK_COLORD = colord('pink')
const PURPLE_COLORD = colord('purple')

// Helper to get methylation color with caching
function getMethColor(prob: number, isHydroxy: boolean): string {
  if (prob > 0.5) {
    const alpha = (prob - 0.5) * 2
    return isHydroxy
      ? PINK_COLORD.alpha(alpha).toHslString()
      : RED_COLORD.alpha(alpha).toHslString()
  } else {
    const alpha = 1 - prob * 2
    return isHydroxy
      ? PURPLE_COLORD.alpha(alpha).toHslString()
      : BLUE_COLORD.alpha(alpha).toHslString()
  }
}

// Color by methylation is slightly modified version of color by modifications
// at reference CpG sites, with non-methylated CpG colored (looking only at the
// MM tag can not tell you where reference CpG sites are)
export function renderMethylation({
  ctx,
  feat,
  region,
  bpPerPx,
  renderArgs,
  canvasWidth,
  cigarOps,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  region: Region
  bpPerPx: number
  renderArgs: ProcessedRenderArgs
  canvasWidth: number
  cigarOps: number[]
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

  function getCol(k: number): string | undefined {
    if (methBins[k]) {
      const p = methProbs[k] || 0
      return getMethColor(p, false)
    }
    if (hydroxyMethBins[k]) {
      const p = hydroxyMethProbs[k] || 0
      return getMethColor(p, true)
    }
    return undefined
  }

  const regionStart = region.start
  const len = fend - fstart
  const zoomedOut = bpPerPx > 2
  const C_CHAR = 99 // 'c' char code
  const G_CHAR = 103 // 'g' char code

  for (let i = 0; i < len; i++) {
    const j = i + fstart
    const rIdx = j - regionStart

    // Use charCodeAt with bitwise OR for case-insensitive comparison
    // 0x20 converts both upper and lowercase to lowercase
    const l1 = regionSequence.charCodeAt(rIdx + 1) | 0x20
    const l2 = regionSequence.charCodeAt(rIdx + 2) | 0x20

    if (l1 === C_CHAR && l2 === G_CHAR) {
      if (zoomedOut) {
        const [leftPx, rightPx] = bpSpanPx(j, j + 2, region, bpPerPx)
        const w = rightPx - leftPx + 0.5
        const c = getCol(i) || getCol(i + 1) || 'blue'
        fillRectCtx(ctx, leftPx, topPx, w, heightPx, canvasWidth, c)
      } else {
        const [leftPx, rightPx] = bpSpanPx(j, j + 1, region, bpPerPx)
        const w = rightPx - leftPx + 0.5
        const c = getCol(i) || 'blue'
        fillRectCtx(ctx, leftPx, topPx, w, heightPx, canvasWidth, c)
        const [leftPx2, rightPx2] = bpSpanPx(j + 1, j + 2, region, bpPerPx)
        const w2 = rightPx2 - leftPx2 + 0.5
        const c2 = getCol(i + 1) || 'blue'
        fillRectCtx(ctx, leftPx2, topPx, w2, heightPx, canvasWidth, c2)
      }
    }
  }
}
