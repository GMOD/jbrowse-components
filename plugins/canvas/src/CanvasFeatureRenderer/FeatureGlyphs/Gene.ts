import { Feature } from '@jbrowse/core/util/simpleFeature'
import { BaseLayout } from '@jbrowse/core/util/layouts/BaseLayout'

// locals
import BoxGlyph from './Box'
import NoncodingGlyph from './UnprocessedTranscript'
import ProcessedTranscriptGlyph from './ProcessedTranscript'
import { ViewInfo, LaidOutFeatureRect } from '../FeatureGlyph'

interface FeatureRectWithGlyph extends LaidOutFeatureRect {
  label: any
  rect: { h: number; t: number }
}
interface LaidOutFeatureRectWithSubRects extends LaidOutFeatureRect {
  subRects?: FeatureRectWithGlyph[]
}

const getLabel = (f: Feature) => f.get('name') || f.get('id') || ''

export default class Gene extends BoxGlyph {
  getFeatureRectangle(viewArgs: ViewInfo, feature: Feature) {
    // we need to lay out rects for each of the subfeatures
    const subArgs = viewArgs
    const subfeatures = feature.children()

    // if this gene has no subfeatures, just render as a box
    if (!subfeatures?.length) {
      return super.getFeatureRectangle(viewArgs, feature)
    }

    let l = Infinity
    let r = -Infinity
    let h = 0

    const subRects = subfeatures
      .sort((a, b) => getLabel(a).localeCompare(getLabel(b)))
      .map(sub => {
        const glyph = this.getSubGlyph(sub)
        const subRect = glyph.getFeatureRectangle(subArgs, sub)
        const rect = subRect.rect
        if (!rect) {
          console.warn('feature not laid out')
          return
        }

        const padding = 1
        const newTop = h + padding

        // const transcriptLabel = this.makeSideLabel(
        //   this.getFeatureLabel(sub),
        //   subRect,
        // )

        // if (transcriptLabel) {
        //   subRect.l -= transcriptLabel.w
        //   subRect.w += transcriptLabel.w
        //   if (transcriptLabel.h > subRect.h) {
        //     subRect.h = transcriptLabel.h
        //   }
        //   transcriptLabel.offsetY = Math.floor(subRect.h / 2)
        //   transcriptLabel.offsetX = 0
        // }

        h = newTop + rect.h + padding
        r = Math.max(r, subRect.l + subRect.w - 1)
        l = Math.min(l, subRect.l)

        return {
          ...subRect,
          t: newTop,
          rect: { ...rect, t: newTop },
        }
      })

    // calculate the width
    const w = Math.max(r - l + 1, 2)

    // expand the fRect to accommodate labels if necessary
    return this.expandRectangleWithLabels(viewArgs, feature, {
      l,
      h,
      w,
      subRects,
      f: feature,
      rect: { t: 0, l, h, w },
      t: 0,
    })
  }

  layoutFeature(
    viewInfo: ViewInfo,
    layout: BaseLayout<Feature>,
    feature: Feature,
  ) {
    const fRect = super.layoutFeature(
      viewInfo,
      layout,
      feature,
    ) as LaidOutFeatureRectWithSubRects

    fRect?.subRects?.forEach(subRect => {
      subRect.t += fRect.t
      subRect.rect.t += fRect.t
    })
    return fRect
  }

  getSubGlyph(feature: Feature) {
    const transcriptType = 'mRNA'
    const noncodingType = ['transcript']
    const subType = feature.get('type')
    return subType === transcriptType
      ? new ProcessedTranscriptGlyph()
      : noncodingType.includes(subType)
      ? new NoncodingGlyph()
      : new BoxGlyph()
  }

  renderFeature(
    context: CanvasRenderingContext2D,
    viewInfo: ViewInfo,
    fRect: LaidOutFeatureRectWithSubRects,
  ) {
    fRect.subRects?.forEach(sub => {
      const glyph = this.getSubGlyph(sub.f)
      glyph.renderFeature(context, viewInfo, sub)
    })
  }
}
