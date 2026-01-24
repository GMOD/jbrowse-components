import { readCachedConfig } from '../renderConfig.ts'
import { isOffScreen } from '../util.ts'
import {
  drawConnectingLine,
  drawStrandArrow,
  getStrandArrowPadding,
  layoutChild,
} from './glyphUtils.ts'

import type { DrawContext, FeatureLayout, Glyph, LayoutArgs } from '../types.ts'

const REPEAT_COLOR_MAP: Record<string, string> = {
  CACTA_TIR_transposon: '#e6194b',
  centromeric_repeat: '#3cb44b',
  Copia_LTR_retrotransposon: '#118119',
  Gypsy_LTR_retrotransposon: '#4363d8',
  hAT_TIR_transposon: '#f58231',
  helitron: '#911eb4',
  knob: '#46f0f0',
  L1_LINE_retrotransposon: '#f032e6',
  LINE_element: '#bcf60c',
  long_terminal_repeat: '#fb0',
  low_complexity: '#008080',
  LTR_retrotransposon: '#e6beff',
  Mutator_TIR_transposon: '#9a6324',
  PIF_Harbinger_TIR_transposon: '#fffac8',
  rDNA_intergenic_spacer_element: '#800000',
  repeat_region: '#aaffc3',
  RTE_LINE_retrotransposon: '#808000',
  subtelomere: '#ffd8b1',
  target_site_duplication: '#000075',
  Tc1_Mariner_TIR_transposon: '#808080',
}

const SHORTEN_HEIGHT_FRACTION = 0.65

export const repeatRegionGlyph: Glyph = {
  type: 'RepeatRegion',

  match(feature) {
    const type = feature.get('type')
    const subfeatures = feature.get('subfeatures')
    return type === 'repeat_region' && !!subfeatures?.length
  },

  layout(args: LayoutArgs): FeatureLayout {
    const { feature, bpPerPx, reversed, configContext } = args
    const { config, featureHeight, heightMultiplier } = configContext

    const start = feature.get('start')
    const end = feature.get('end')
    const heightPx = readCachedConfig(featureHeight, config, 'height', feature)
    const baseHeightPx = heightPx * heightMultiplier
    const widthPx = (end - start) / bpPerPx

    const strand = feature.get('strand') as number
    const arrowPadding = getStrandArrowPadding(strand, reversed)

    const subfeatures = feature.get('subfeatures') || []
    const children = subfeatures.map(child => layoutChild(child, feature, args))

    return {
      feature,
      glyphType: 'RepeatRegion',
      x: 0,
      y: 0,
      width: widthPx,
      height: baseHeightPx,
      totalLayoutHeight: baseHeightPx,
      totalLayoutWidth: widthPx + arrowPadding.left + arrowPadding.right,
      leftPadding: arrowPadding.left,
      children,
    }
  },

  draw(ctx: CanvasRenderingContext2D, layout: FeatureLayout, dc: DrawContext) {
    const { children } = layout
    const { theme, canvasWidth } = dc

    const left = layout.x
    const width = layout.width
    const top = layout.y
    const height = layout.height

    if (isOffScreen(left, width, canvasWidth)) {
      return
    }

    const strokeColor = theme.palette.text.secondary

    // Draw connecting line
    drawConnectingLine(ctx, left, top, width, height, strokeColor)

    // Sort children so retrotransposons are drawn first (underneath)
    const sortedChildren = [...children].sort((a, b) => {
      const aType = a.feature.get('type') as string
      const bType = b.feature.get('type') as string
      if (aType.endsWith('_retrotransposon')) {
        return -1
      }
      if (bType.endsWith('_retrotransposon')) {
        return 1
      }
      return 0
    })

    // Draw children
    for (const childLayout of sortedChildren) {
      const childType = childLayout.feature.get('type') as string
      const color = REPEAT_COLOR_MAP[childType] || '#000'
      const shorten = childType.endsWith('_retrotransposon')
      drawRepeatBox(ctx, childLayout, canvasWidth, color, shorten)
    }

    // Draw strand arrow
    drawStrandArrow(ctx, layout, dc, strokeColor)
  },
}

function drawRepeatBox(
  ctx: CanvasRenderingContext2D,
  layout: FeatureLayout,
  canvasWidth: number,
  color: string,
  shorten: boolean,
) {
  const { x: left, width, y, height: origHeight } = layout

  if (isOffScreen(left, width, canvasWidth)) {
    return
  }

  let top = y
  let height = origHeight

  if (shorten) {
    top += ((1 - SHORTEN_HEIGHT_FRACTION) / 2) * height
    height *= SHORTEN_HEIGHT_FRACTION
  }

  ctx.fillStyle = color
  ctx.fillRect(left, top, width, height)
}
