import { readConfObject } from '@jbrowse/core/configuration'
import { bpSpanPx, measureText } from '@jbrowse/core/util'

import FeatureGlyph from '../FeatureGlyph'

import type {
  FeatureRect,
  LaidOutFeatureRect,
  PreLaidOutFeatureRect,
  ViewInfo,
} from '../FeatureGlyph'
import type { Feature } from '@jbrowse/core/util'

export default class Box extends FeatureGlyph {
  makeFeatureLabel(feature: Feature, fRect: FeatureRect, param?: string) {
    const text = param || this.getFeatureLabel(feature)
    return this.makeBottomOrTopLabel(text)
  }

  getFeatureLabel(feature: Feature) {
    return feature.get('name') || feature.get('id')
  }

  getFeatureDescription(feature: Feature) {
    return feature.get('description') || feature.get('note')
  }

  makeFeatureDescriptionLabel(
    feature: Feature,
    fRect: FeatureRect,
    param?: string,
  ) {
    return this.makeBottomOrTopLabel(
      param || this.getFeatureDescription(feature),
    )
  }

  makeSideLabel(text = '') {
    const t2 = text.length > 100 ? `${text.slice(0, 100)}…` : text
    return {
      text: t2,
      baseline: 'middle',
      w: measureText(t2),
      h: 10, // FIXME
      offsetX: 0,
      offsetY: 0,
    }
  }

  makeBottomOrTopLabel(text = '') {
    const t2 = text.length > 100 ? `${text.slice(0, 100)}…` : text
    return {
      text: t2,
      w: measureText(t2, 10),
      h: 10, // FIXME
      offsetY: 0,
    }
  }

  getFeatureRectangle(viewArgs: ViewInfo, feature: Feature) {
    const fRect = super.getFeatureRectangle(viewArgs, feature)
    const { l, h } = fRect

    const w = Math.max(fRect.w, 2)
    return this.expandRectangleWithLabels(viewArgs, feature, {
      ...fRect,
      w,
      rect: {
        l,
        h,
        w,
        t: 0,
      },
    })
  }

  expandRectangleWithLabels<T extends PreLaidOutFeatureRect>(
    view: ViewInfo,
    f: Feature,
    fRect: T,
  ) {
    const { config } = view
    const showLabels = readConfObject(config, 'showLabels')
    const label = showLabels ? this.makeFeatureLabel(f, fRect) : undefined
    if (label?.text) {
      fRect.h += label.h
      fRect.w = Math.max(label.w, fRect.w)
      label.offsetY = fRect.h
    }
    const showDescriptions = readConfObject(config, 'showDescriptions')
    const description = showDescriptions
      ? this.makeFeatureDescriptionLabel(f, fRect)
      : undefined

    if (description?.text) {
      fRect.h += description.h
      // fRect.w = Math.max(description.w, fRect.w)
      description.offsetY = fRect.h // -marginBottom removed in jb2
    }
    return {
      ...fRect,
      description,
      label,
    }
  }

  renderFeature(
    context: CanvasRenderingContext2D,
    viewInfo: ViewInfo,
    fRect: LaidOutFeatureRect & { rect: { h: number } },
  ) {
    this.renderBox(context, viewInfo, fRect.f, fRect.t, fRect.rect.h)
  }

  renderBox(
    context: CanvasRenderingContext2D,
    viewInfo: ViewInfo,
    feature: Feature,
    top: number,
    overallHeight: number,
  ) {
    const { config, region, bpPerPx } = viewInfo
    const [leftPx, rightPx] = bpSpanPx(
      feature.get('start'),
      feature.get('end'),
      region,
      bpPerPx,
    )
    const left = leftPx
    const width = Math.max(rightPx - leftPx, 2)

    const height = this.getFeatureHeight(viewInfo, feature)
    if (height !== overallHeight) {
      top += (overallHeight - height) / 2
    }

    context.fillStyle = readConfObject(
      config,
      this.isUTR(feature) ? 'color3' : 'color1',
      { feature },
    )
    context.fillRect(left, top, width, height)
  }

  getFeatureHeight(viewInfo: ViewInfo, feature: Feature) {
    const height = super.getFeatureHeight(viewInfo, feature)
    return this.isUTR(feature) ? height * 0.7 : height
  }

  protected isUTR(feature: Feature) {
    return /(\bUTR|_UTR|untranslated[_\s]region)\b/.test(
      feature.get('type') || '',
    )
  }
}
