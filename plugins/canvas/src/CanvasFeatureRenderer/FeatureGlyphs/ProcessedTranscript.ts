import SegmentsGlyph from './Segments'

import type { LaidOutFeatureRect, ViewInfo } from '../FeatureGlyph'
import type { Feature } from '@jbrowse/core/util'

function filterSubpart(f: Feature) {
  const ret = new Set(
    ['CDS', 'UTR', 'five_prime_UTR', 'three_prime_UTR'].map(s =>
      s.toLowerCase(),
    ),
  )

  return ret.has(f.get('type').toLowerCase())
}

function getSubparts(f: Feature) {
  const subfeatures = f.children()
  const hasCDS = subfeatures?.some(f => f.get('type') === 'CDS')

  return !subfeatures
    ? []
    : hasCDS
      ? subfeatures.filter(element => filterSubpart(element))
      : subfeatures
}

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
