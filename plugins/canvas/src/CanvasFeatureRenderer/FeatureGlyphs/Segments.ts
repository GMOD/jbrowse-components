import { bpSpanPx, Feature } from '@jbrowse/core/util'

// locals
import { LaidOutFeatureRect, ViewInfo } from '../FeatureGlyph'
import BoxGlyph from './Box'

export default class Segments extends BoxGlyph {
  renderFeature(
    context: CanvasRenderingContext2D,
    viewInfo: ViewInfo,
    fRect: LaidOutFeatureRect,
  ) {
    this.renderConnector(context, viewInfo, fRect)
    this.renderSegments(context, viewInfo, fRect)
  }

  renderConnector(
    context: CanvasRenderingContext2D,
    viewInfo: ViewInfo,
    fRect: LaidOutFeatureRect,
  ) {
    const { bpPerPx, region } = viewInfo
    const thickness = 1
    context.fillStyle = 'black'
    const {
      f,
      t,
      rect: { h },
    } = fRect
    const [leftPx, rightPx] = bpSpanPx(
      f.get('start'),
      f.get('end'),
      region,
      bpPerPx,
    )
    context.fillRect(
      leftPx,
      t + (h - thickness) / 2,
      rightPx - leftPx,
      thickness,
    )
  }

  renderSegments(
    context: CanvasRenderingContext2D,
    viewInfo: ViewInfo,
    fRect: LaidOutFeatureRect,
  ) {
    const { t, f } = fRect
    f.children()?.forEach(sub => {
      this.renderSegment(context, viewInfo, sub, t, fRect.rect.h)
    })
  }

  renderSegment(
    context: CanvasRenderingContext2D,
    viewInfo: ViewInfo,
    feat: Feature,
    topPx: number,
    heightPx: number,
  ) {
    super.renderBox(context, viewInfo, feat, topPx, heightPx)
    feat.children()?.forEach(sub => {
      this.renderSegment(context, viewInfo, sub, topPx, heightPx)
    })
  }
}
