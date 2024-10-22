import { Feature } from '@jbrowse/core/util'
import { ViewInfo } from '../FeatureGlyph'
import SegmentsGlyph from './Segments'

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
