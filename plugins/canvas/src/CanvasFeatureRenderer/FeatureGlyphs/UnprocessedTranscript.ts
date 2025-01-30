import SegmentsGlyph from './Segments'

import type { ViewInfo } from '../FeatureGlyph'
import type { Feature } from '@jbrowse/core/util'


export default class UnprocessedTranscript extends SegmentsGlyph {
  renderBox(
    context: CanvasRenderingContext2D,
    viewInfo: ViewInfo,
    feature: Feature,
    top: number,
    overallHeight: number,
  ) {
    super.renderBox(context, viewInfo, feature, top, overallHeight)
  }
}
