import {
  readConfObject,
  AnyConfigurationModel,
} from '@jbrowse/core/configuration'
import { bpSpanPx, Feature } from '@jbrowse/core/util'
import { Region } from '@jbrowse/core/util/types'
import { BaseLayout } from '@jbrowse/core/util/layouts/BaseLayout'

export interface ViewInfo {
  bpPerPx: number
  region: Region
  config: AnyConfigurationModel
}

export interface FeatureRect {
  l: number
  w: number
  f: Feature
}

export interface LaidOutFeatureRect extends FeatureRect {
  label?: { text: string; offsetY: number }
  description?: { text: string; offsetY: number }
  t: number
  h: number
  rect: any
}

interface Rect {
  l: number
  t: number
  w: number
}

export default abstract class FeatureGlyph {
  layoutFeature(
    viewArgs: ViewInfo,
    layout: BaseLayout<Feature>,
    feature: Feature,
  ) {
    const fRect = this.getFeatureRectangle(viewArgs, feature)

    const { region, bpPerPx } = viewArgs
    const scale = 1 / bpPerPx
    const leftBase = region.start
    const startbp = fRect.l / scale + leftBase
    const endbp = (fRect.l + fRect.w) / scale + leftBase
    const top = layout.addRect(feature.id(), startbp, endbp, fRect.h)
    if (top === null) {
      return null
    }

    return { ...fRect, f: feature, t: top }
  }

  abstract renderFeature(
    context: CanvasRenderingContext2D,
    viewInfo: ViewInfo,
    fRect: LaidOutFeatureRect,
  ): void

  getFeatureRectangle(viewInfo: ViewInfo, feature: Feature) {
    const { region, bpPerPx } = viewInfo
    const [leftPx, rightPx] = bpSpanPx(
      feature.get('start'),
      feature.get('end'),
      region,
      bpPerPx,
    )

    return {
      l: leftPx,
      w: rightPx - leftPx,
      h: this.getFeatureHeight(viewInfo, feature),
      f: feature,
      t: 0,
      rect: undefined as Rect | undefined,
    }
  }

  getFeatureHeight(viewInfo: ViewInfo, feature: Feature) {
    return readConfObject(viewInfo.config, 'height', { feature })
  }
}
