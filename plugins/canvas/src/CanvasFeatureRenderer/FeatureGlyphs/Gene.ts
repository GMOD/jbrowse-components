import { Feature } from '@jbrowse/core/util/simpleFeature'
import { BaseLayout } from '@jbrowse/core/util/layouts/BaseLayout'

// locals
import BoxGlyph from './Box'
import NoncodingGlyph from './UnprocessedTranscript'
import ProcessedTranscriptGlyph from './ProcessedTranscript'
import { ViewInfo, LaidOutFeatureRect } from '../FeatureGlyph'

interface FeatureRectWithGlyph extends LaidOutFeatureRect {
  label: any
  rect: { h: number }
}
interface LaidOutFeatureRectWithSubRects extends LaidOutFeatureRect {
  subRects?: FeatureRectWithGlyph[]
}

export default class Gene extends BoxGlyph {
  getFeatureRectangle(viewArgs: ViewInfo, feature: Feature) {
    // we need to lay out rects for each of the subfeatures
    const subArgs = viewArgs
    // subArgs.showDescriptions = false
    // subArgs.showLabels = false
    const subfeatures = feature.children()

    // if this gene weirdly has no subfeatures, just render as a box
    if (!subfeatures?.length) {
      return super.getFeatureRectangle(viewArgs, feature)
    }

    // get the rects for the children
    const fRect = {
      l: 0,
      h: 0,
      r: 0,
      w: 0,
      subRects: [] as FeatureRectWithGlyph[],
      f: feature,
      t: 0,
    }
    // sort the children by name
    const label = (f: Feature) => f.get('name') || f.get('id') || ''
    subfeatures?.sort((a, b) => label(a).localeCompare(label(b)))

    fRect.l = Infinity
    fRect.r = -Infinity

    subfeatures.forEach(sub => {
      const glyph = this.getSubGlyph(sub)
      const subRect = glyph.getFeatureRectangle(subArgs, sub)

      const padding = 1
      const newTop = fRect.h ? fRect.h + padding : 0
      subRect.t = newTop
      subRect.rect.t = newTop

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

      fRect.subRects.push(subRect) // { ...subRect, label: transcriptLabel })
      fRect.r = Math.max(fRect.r, subRect.l + subRect.w - 1)
      fRect.l = Math.min(fRect.l, subRect.l)
      fRect.h = subRect.t + subRect.rect.h + padding
    })

    // calculate the width
    fRect.w = Math.max(fRect.r - fRect.l + 1, 2)

    // expand the fRect to accommodate labels if necessary
    return this.expandRectangleWithLabels(viewArgs, feature, fRect)
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
