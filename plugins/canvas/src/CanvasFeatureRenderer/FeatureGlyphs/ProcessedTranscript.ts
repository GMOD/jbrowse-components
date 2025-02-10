import SegmentsGlyph from './Segments'

import type { LaidOutFeatureRect, ViewInfo } from '../FeatureGlyph'
import type { Feature } from '@jbrowse/core/util'

// returns a callback that will filter features features according to the
// subParts conf var
function makeSubpartsFilter(_confKey: string | string[]) {
  const ret = ['CDS', 'UTR', 'five_prime_UTR', 'three_prime_UTR']

  return (feature: Feature) =>
    ret
      .map(typeName => typeName.toLowerCase())
      .includes(feature.get('type').toLowerCase())
}

function filterSubpart(feature: Feature) {
  return makeSubpartsFilter('subParts')(feature)
}

export default class ProcessedTranscript extends SegmentsGlyph {
  protected getSubparts(f: Feature) {
    const subfeatures = f.children()
    const hasCDS = subfeatures?.some(f => f.get('type') === 'CDS')
    //     if (c && this.config.inferCdsParts) {
    //       c = this.makeCDSs(f, c)
    //     }

    //     if (c && this.config.impliedUTRs) {
    //       c = this.makeUTRs(f, c)
    //     }

    return !subfeatures
      ? []
      : hasCDS
        ? subfeatures.filter(element => filterSubpart(element))
        : subfeatures
  }

  renderSegments(
    context: CanvasRenderingContext2D,
    viewInfo: ViewInfo,
    fRect: LaidOutFeatureRect,
  ) {
    const { t, f } = fRect
    this.getSubparts(f).forEach(sub => {
      this.renderSegment(context, viewInfo, sub, t, fRect.rect.h)
    })
  }
}
