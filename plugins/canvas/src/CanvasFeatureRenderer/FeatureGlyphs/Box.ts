import { measureText } from '@jbrowse/core/util'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'
import { bpSpanPx } from '@jbrowse/core/util'

// locals
import FeatureGlyph, {
  ViewInfo,
  FeatureRect,
  LaidOutFeatureRect,
} from '../FeatureGlyph'

export default class Box extends FeatureGlyph {
  makeFeatureLabel(feature: Feature, fRect: FeatureRect, param?: string) {
    const text = param || this.getFeatureLabel(feature)
    return this.makeBottomOrTopLabel(text, fRect)
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
    const text = param || this.getFeatureDescription(feature)
    return this.makeBottomOrTopLabel(text, fRect)
  }

  makeSideLabel(text: string, fRect: FeatureRect) {
    if (text.length > 100) {
      text = text.slice(0, 100) + '…'
    }

    return {
      text: text,
      baseline: 'middle',
      w: measureText(text),
      h: 10, // FIXME
      offsetX: 0,
      offsetY: 0,
    }
  }

  makeBottomOrTopLabel(text = '', fRect: FeatureRect) {
    if (text.length > 100) {
      text = text.slice(0, 100) + '…'
    }
    return {
      text: text,
      w: measureText(text),
      h: 10, // FIXME
      offsetY: 0,
    }
  }

  getFeatureRectangle(viewArgs: ViewInfo, feature: Feature) {
    const fRect = super.getFeatureRectangle(viewArgs, feature)

    const { l, h } = fRect
    const w = Math.max(fRect.w, 2)

    // fixme maybe
    // const i = { width: 16 }
    // if (strand === -1) {
    //   fRect.w += i.width
    //   fRect.l -= i.width
    // } else if (strand === 1) {
    //   fRect.w += i.width
    // }

    return this.expandRectangleWithLabels(viewArgs, feature, {
      ...fRect,
      w,
      rect: { h, l, w, t: 0 },
    })
  }

  // given an under-construction feature layout rectangle, expand it to
  // accomodate a label and/or a description
  expandRectangleWithLabels(
    viewInfo: ViewInfo,
    feature: Feature,
    fRect: FeatureRect & {
      h: number
      t?: number
      rect?: { l: number; w: number; h: number; t: number }
    },
  ) {
    // maybe get the feature's name, and update the layout box accordingly
    const { config } = viewInfo
    const showLabels = readConfObject(config, 'showLabels')
    const label = showLabels ? this.makeFeatureLabel(feature, fRect) : undefined
    if (label) {
      fRect.h += label.h
      fRect.w = Math.max(label.w, fRect.w)
      label.offsetY = fRect.h
    }
    // maybe get the feature's description if available, and
    // update the layout box accordingly
    const showDescriptions = readConfObject(config, 'showDescriptions')
    const description = showDescriptions
      ? this.makeFeatureDescriptionLabel(feature, fRect)
      : undefined
    if (description) {
      fRect.h += description.h
      fRect.w = Math.max(description.w, fRect.w)
      description.offsetY = fRect.h // -marginBottom removed in jb2
    }
    return { ...fRect, description, label }
  }

  _embeddedImages = {
    plusArrow: {
      data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAFCAYAAACXU8ZrAAAATUlEQVQIW2NkwATGQKFYIG4A4g8gacb///+7AWlBmNq+vj6V4uLiJiD/FRBXA/F8xu7u7kcVFRWyMEVATQz//v0Dcf9CxaYRZxIxbgIARiAhmifVe8UAAAAASUVORK5CYII=',
      width: 9,
      height: 5,
    },

    minusArrow: {
      data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAFCAYAAACXU8ZrAAAASklEQVQIW2NkQAABILMBiBcD8VkkcQZGIAeEE4G4FYjFent764qKiu4gKXoPUjAJiLOggsxMTEwMjIwgYQjo6Oh4TLRJME043QQA+W8UD/sdk9IAAAAASUVORK5CYII=',
      width: 9,
      height: 5,
    },
  }

  renderFeature(
    context: CanvasRenderingContext2D,
    viewInfo: ViewInfo,
    fRect: LaidOutFeatureRect & { rect: { h: number } },
  ) {
    this.renderBox(context, viewInfo, fRect.f, fRect.t, fRect.rect.h)
  }

  // top and height are in px
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
    const width = rightPx - leftPx

    const height = this.getFeatureHeight(viewInfo, feature)
    if (height !== overallHeight) {
      top += (overallHeight - height) / 2
    }

    context.fillStyle = readConfObject(config, 'color1', { feature })
    context.fillRect(left, top, Math.max(1, width), height)
  }

  postDraw(
    ctx: CanvasRenderingContext2D,
    props: {
      record: LaidOutFeatureRect
      regions: { start: number; end: number; reversed: boolean }[]
      offsetPx: number
    },
  ) {
    const { regions, record, offsetPx } = props
    const { start, end, l, t, label, description } = record
    const [region] = regions

    function renderText({ text, offsetY }: { text: string; offsetY: number }) {
      if (start < region.start && region.start < end) {
        ctx.fillText(text, offsetPx, t + offsetY)
      } else {
        ctx.fillText(text, l, t + offsetY)
      }
    }
    if (label) {
      ctx.fillStyle = 'black'
      renderText(label)
    }

    if (description) {
      ctx.fillStyle = 'blue'
      renderText(description)
    }
  }
}
