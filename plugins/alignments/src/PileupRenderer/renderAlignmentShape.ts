import { bpSpanPx } from '@jbrowse/core/util'
import { RenderArgsDeserialized } from './PileupRenderer'
import { LayoutFeature } from './util'

export function renderAlignmentShape({
  ctx,
  feat,
  renderArgs,
}: {
  ctx: CanvasRenderingContext2D
  feat: LayoutFeature
  renderArgs: RenderArgsDeserialized
}) {
  const { regions, bpPerPx } = renderArgs
  const { heightPx, topPx, feature } = feat
  const [region] = regions
  const s = feature.get('start')
  const e = feature.get('end')
  const [leftPx, rightPx] = bpSpanPx(s, e, region, bpPerPx)
  const flip = region.reversed ? -1 : 1
  const strand = feature.get('strand') * flip
  if (bpPerPx < 10 && heightPx > 5) {
    if (strand === -1) {
      ctx.beginPath()
      ctx.moveTo(leftPx - 5, topPx + heightPx / 2)
      ctx.lineTo(leftPx, topPx + heightPx)
      ctx.lineTo(rightPx, topPx + heightPx)
      ctx.lineTo(rightPx, topPx)
      ctx.lineTo(leftPx, topPx)
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.moveTo(leftPx, topPx)
      ctx.lineTo(leftPx, topPx + heightPx)
      ctx.lineTo(rightPx, topPx + heightPx)
      ctx.lineTo(rightPx + 5, topPx + heightPx / 2)
      ctx.lineTo(rightPx, topPx)
      ctx.closePath()
      ctx.fill()
    }
  } else {
    ctx.fillRect(leftPx, topPx, rightPx - leftPx, heightPx)
  }
}
