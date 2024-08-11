import { bpSpanPx, Region } from '@jbrowse/core/util'
import { getMethBins } from '../MismatchParser'
import { fillRect, LayoutFeature } from './util'
import { RenderArgsWithColor } from './makeImageData'
import { colord } from '@jbrowse/core/util/colord'

// Color by methylation is slightly modified version of color by
// modifications that focuses on CpG sites, with non-methylated CpG colored
export function renderMethylation({
  ctx,
  feat,
  region,
  bpPerPx,
  renderArgs,
  canvasWidth,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  region: Region
  bpPerPx: number
  renderArgs: RenderArgsWithColor
  canvasWidth: number
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
  const { methBins, methProbs } = getMethBins(feature)

  function getCol(k: number) {
    if (methBins[k]) {
      const p = methProbs[k] || 0
      return (
        p > 0.5
          ? colord('red').alpha((p - 0.5) * 2)
          : colord('blue').alpha(1 - p * 2)
      ).toHslString()
    }
    return undefined
  }
  for (let i = 0; i < fend - fstart; i++) {
    const j = i + fstart
    const l1 = regionSequence[j - region.start + 1]?.toLowerCase()
    const l2 = regionSequence[j - region.start + 2]?.toLowerCase()

    if (l1 === 'c' && l2 === 'g') {
      if (bpPerPx > 2) {
        const [leftPx, rightPx] = bpSpanPx(j, j + 2, region, bpPerPx)
        const w = rightPx - leftPx + 0.5
        const c = getCol(i) || getCol(i + 1) || 'blue'
        fillRect(ctx, leftPx, topPx, w, heightPx, canvasWidth, c)
      } else {
        const [leftPx, rightPx] = bpSpanPx(j, j + 1, region, bpPerPx)
        const w = rightPx - leftPx + 0.5
        const c = getCol(i) || 'blue'
        fillRect(ctx, leftPx, topPx, w, heightPx, canvasWidth, c)
        const [leftPx2, rightPx2] = bpSpanPx(j + 1, j + 2, region, bpPerPx)
        const w2 = rightPx2 - leftPx2 + 0.5
        const c2 = getCol(i + 1) || 'blue'
        fillRect(ctx, leftPx2, topPx, w2, heightPx, canvasWidth, c2)
      }
    }
  }
}
