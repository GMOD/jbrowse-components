import { readCachedConfig } from '../renderConfig'
import { isOffScreen } from '../util'

import type { DrawContext, FeatureLayout, Glyph, LayoutArgs } from '../types'
import type { Feature } from '@jbrowse/core/util'

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
const STRAND_ARROW_PADDING = 8

function getStrandArrowPadding(strand: number, reversed: boolean) {
  const reverseFlip = reversed ? -1 : 1
  const effectiveStrand = strand * reverseFlip
  return {
    leftPadding: effectiveStrand === -1 ? STRAND_ARROW_PADDING : 0,
    rightPadding: effectiveStrand === 1 ? STRAND_ARROW_PADDING : 0,
  }
}

function layoutChild(
  child: Feature,
  parentFeature: Feature,
  args: LayoutArgs,
): FeatureLayout {
  const { bpPerPx, reversed, configContext } = args
  const { config, displayMode, featureHeight } = configContext

  const heightPx = readCachedConfig(featureHeight, config, 'height', child)
  const baseHeightPx = displayMode === 'compact' ? heightPx / 2 : heightPx

  const childStart = child.get('start') as number
  const childEnd = child.get('end') as number
  const parentStart = parentFeature.get('start') as number
  const parentEnd = parentFeature.get('end') as number

  const widthPx = (childEnd - childStart) / bpPerPx

  const offsetBp = reversed ? parentEnd - childEnd : childStart - parentStart
  const xRelativePx = offsetBp / bpPerPx

  return {
    feature: child,
    glyphType: 'Box',
    x: xRelativePx,
    y: 0,
    width: widthPx,
    height: baseHeightPx,
    totalFeatureHeight: baseHeightPx,
    totalLayoutHeight: baseHeightPx,
    totalLayoutWidth: widthPx,
    leftPadding: 0,
    children: [],
  }
}

export const repeatRegionGlyph: Glyph = {
  type: 'RepeatRegion',

  match(feature) {
    const type = feature.get('type')
    const subfeatures = feature.get('subfeatures') as Feature[] | undefined
    return type === 'repeat_region' && !!subfeatures?.length
  },

  layout(args: LayoutArgs): FeatureLayout {
    const { feature, bpPerPx, reversed, configContext } = args
    const { config, displayMode, featureHeight } = configContext

    const featureStart = feature.get('start') as number
    const featureEnd = feature.get('end') as number
    const heightPx = readCachedConfig(featureHeight, config, 'height', feature)
    const baseHeightPx = displayMode === 'compact' ? heightPx / 2 : heightPx
    const widthPx = (featureEnd - featureStart) / bpPerPx

    const strand = feature.get('strand') as number
    const arrowPadding = getStrandArrowPadding(strand, reversed)

    const subfeatures = (feature.get('subfeatures') || []) as Feature[]
    const children = subfeatures.map(child => layoutChild(child, feature, args))

    return {
      feature,
      glyphType: 'RepeatRegion',
      x: 0,
      y: 0,
      width: widthPx,
      height: baseHeightPx,
      totalFeatureHeight: baseHeightPx,
      totalLayoutHeight: baseHeightPx,
      totalLayoutWidth: widthPx + arrowPadding.leftPadding + arrowPadding.rightPadding,
      leftPadding: arrowPadding.leftPadding,
      children,
    }
  },

  draw(ctx: CanvasRenderingContext2D, layout: FeatureLayout, dc: DrawContext) {
    const { feature, children } = layout
    const { region, theme, canvasWidth } = dc
    const reversed = region.reversed ?? false

    const left = layout.x
    const width = layout.width
    const top = layout.y
    const height = layout.height

    if (isOffScreen(left, width, canvasWidth)) {
      return
    }

    // Draw connecting line
    const strokeColor = theme.palette.text.secondary
    const centerY = top + height / 2

    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(left, centerY)
    ctx.lineTo(left + width, centerY)
    ctx.stroke()

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
    drawArrow(ctx, layout, dc)
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

function drawArrow(
  ctx: CanvasRenderingContext2D,
  layout: FeatureLayout,
  dc: DrawContext,
) {
  const { feature } = layout
  const { region, theme, canvasWidth } = dc
  const reversed = region.reversed ?? false

  const left = layout.x
  const width = layout.width

  if (isOffScreen(left, width, canvasWidth)) {
    return
  }

  const strand = feature.get('strand') as number
  if (!strand) {
    return
  }

  const size = 5
  const reverseFlip = reversed ? -1 : 1
  const offset = 7 * strand * reverseFlip
  const top = layout.y
  const height = layout.height
  const centerY = top + height / 2

  const strokeColor = theme.palette.text.secondary

  const p =
    strand * reverseFlip === -1
      ? left
      : strand * reverseFlip === 1
        ? left + width
        : null

  if (p !== null) {
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(p, centerY)
    ctx.lineTo(p + offset, centerY)
    ctx.stroke()

    ctx.fillStyle = strokeColor
    ctx.beginPath()
    ctx.moveTo(p + offset / 2, centerY - size / 2)
    ctx.lineTo(p + offset / 2, centerY + size / 2)
    ctx.lineTo(p + offset, centerY)
    ctx.closePath()
    ctx.fill()
  }
}
