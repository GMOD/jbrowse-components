import { ViewInfo } from '../FeatureGlyph'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import SegmentsGlyph from './Segments'

export default class UnprocessedTranscript extends SegmentsGlyph {
  renderBox(
    context: CanvasRenderingContext2D,
    viewInfo: ViewInfo,
    feature: Feature,
    top: number,
    overallHeight: number,
  ) {
    return super.renderBox(context, viewInfo, feature, top, overallHeight)
  }
}
