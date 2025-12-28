import { readCachedConfig } from '../renderConfig'
import { getBoxColor, isOffScreen, isUTR } from '../util'

import type { DrawContext, FeatureLayout, Glyph, LayoutArgs } from '../types'

const UTR_HEIGHT_FRACTION = 0.65

export const boxGlyph: Glyph = {
  type: 'Box',

  match(feature) {
    const type = feature.get('type')
    if (type === 'CDS') {
      return false
    }
    const subfeatures = feature.get('subfeatures')
    return !subfeatures?.length
  },

  layout(args: LayoutArgs): FeatureLayout {
    const { feature, bpPerPx, configContext } = args
    const { config, displayMode, featureHeight } = configContext

    const height = readCachedConfig(featureHeight, config, 'height', feature)
    const baseHeight = displayMode === 'compact' ? height / 2 : height
    const width = (feature.get('end') - feature.get('start')) / bpPerPx

    return {
      feature,
      glyphType: 'Box',
      x: 0,
      y: 0,
      width,
      height: baseHeight,
      totalFeatureHeight: baseHeight,
      totalLayoutHeight: baseHeight,
      totalLayoutWidth: width,
      leftPadding: 0,
      children: [],
    }
  },

  draw(ctx: CanvasRenderingContext2D, layout: FeatureLayout, dc: DrawContext) {
    const { feature } = layout
    const { region, bpPerPx, configContext, theme, canvasWidth } = dc
    const { config } = configContext
    const colorByCDS = dc.colorByCDS ?? false

    const { start, end } = region
    const screenWidth = Math.ceil((end - start) / bpPerPx)
    const width = layout.width
    const left = layout.x

    if (
      isOffScreen(left, width, canvasWidth) ||
      (feature.parent?.() && feature.get('type') === 'intron')
    ) {
      return
    }

    let top = layout.y
    let height = layout.height

    if (isUTR(feature)) {
      top += ((1 - UTR_HEIGHT_FRACTION) / 2) * height
      height *= UTR_HEIGHT_FRACTION
    }

    const leftWithinBlock = Math.max(left, 0)
    const diff = leftWithinBlock - left
    const widthWithinBlock = Math.max(2, Math.min(width - diff, screenWidth))

    const fill = getBoxColor({
      feature,
      config,
      configContext,
      colorByCDS,
      theme,
    })

    const stroke = readCachedConfig(
      configContext.outline,
      config,
      'outline',
      feature,
    )

    ctx.fillStyle = fill
    ctx.fillRect(leftWithinBlock, top, widthWithinBlock, height)
    if (stroke) {
      ctx.strokeStyle = stroke
      ctx.lineWidth = 1
      ctx.strokeRect(leftWithinBlock, top, widthWithinBlock, height)
    }
  },
}
