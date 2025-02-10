import SegmentsGlyph from './Segments'

import { getSubparts } from './util'

import type { LaidOutFeatureRect, ViewInfo } from '../FeatureGlyph'

export default class ProcessedTranscript extends SegmentsGlyph {
  renderSegments(
    context: CanvasRenderingContext2D,
    viewInfo: ViewInfo,
    fRect: LaidOutFeatureRect,
  ) {
    const { t, f } = fRect
    getSubparts(f).forEach(sub => {
      this.renderSegment(context, viewInfo, sub, t, fRect.rect.h)
    })
  }
}
