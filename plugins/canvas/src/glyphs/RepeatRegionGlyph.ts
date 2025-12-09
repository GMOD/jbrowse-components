/**
 * RepeatRegionGlyph - Example of a pluggable glyph for the CanvasFeatureRenderer
 *
 * This glyph renders repeat_region features (e.g., LTR retrotransposons from EDTA)
 * with type-specific coloring for different transposon families.
 *
 * To create your own pluggable glyph:
 * 1. Create a new GlyphType with name, draw function, and match function
 * 2. Register it with pluginManager.addGlyphType(() => yourGlyph)
 *
 * The match() function determines which features this glyph handles.
 * The draw() function receives a GlyphRenderContext with canvas context,
 * feature data, layout information, and theme.
 */
import { GlyphType } from '@jbrowse/core/pluggableElementTypes'

import type {
  GlyphFeatureLayout,
  GlyphRenderContext,
} from '@jbrowse/core/pluggableElementTypes/GlyphType'
import type { Feature } from '@jbrowse/core/util'

// Color mapping for different transposon/repeat types
const repeatColorMap: Record<string, string> = {
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

const shortenHeightFraction = 0.65

function isOffScreen(left: number, width: number, canvasWidth: number) {
  return left + width < 0 || left > canvasWidth
}

function drawSegmentLine(ctx: GlyphRenderContext) {
  const { ctx: context, featureLayout, canvasWidth, theme } = ctx
  const { x: left, width, y: top, height } = featureLayout

  if (isOffScreen(left, width, canvasWidth)) {
    return
  }

  const y = top + height / 2
  const color2 = theme.palette.text.secondary

  context.strokeStyle = color2
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(left, y)
  context.lineTo(left + width, y)
  context.stroke()
}

function drawRepeatBox(
  ctx: CanvasRenderingContext2D,
  featureLayout: GlyphFeatureLayout,
  canvasWidth: number,
  color: string,
  shorten: boolean,
) {
  const { x: left, width, y, height: origHeight } = featureLayout

  if (isOffScreen(left, width, canvasWidth)) {
    return
  }

  let top = y
  let height = origHeight

  if (shorten) {
    top += ((1 - shortenHeightFraction) / 2) * height
    height *= shortenHeightFraction
  }

  ctx.fillStyle = color
  ctx.fillRect(left, top, width, height)
}

function drawArrow(ctx: GlyphRenderContext) {
  const {
    ctx: context,
    feature,
    featureLayout,
    reversed,
    canvasWidth,
    theme,
  } = ctx
  const { x: left, width, y: top, height } = featureLayout

  if (isOffScreen(left, width, canvasWidth)) {
    return
  }

  const strand = feature.get('strand')
  const size = 5
  const reverseFlip = reversed ? -1 : 1
  const offset = 7 * strand * reverseFlip
  const y = top + height / 2
  const color2 = theme.palette.text.secondary

  const p =
    strand * reverseFlip === -1
      ? left
      : strand * reverseFlip === 1
        ? left + width
        : null

  if (p !== null) {
    context.strokeStyle = color2
    context.lineWidth = 1
    context.beginPath()
    context.moveTo(p, y)
    context.lineTo(p + offset, y)
    context.stroke()

    context.fillStyle = color2
    context.strokeStyle = color2
    context.beginPath()
    context.moveTo(p + offset / 2, y - size / 2)
    context.lineTo(p + offset / 2, y + size / 2)
    context.lineTo(p + offset, y)
    context.closePath()
    context.fill()
    context.stroke()
  }
}

/**
 * Main draw function for the RepeatRegion glyph
 *
 * Renders:
 * 1. A horizontal line through the center of the feature
 * 2. Colored boxes for each child feature (sorted so retrotransposons draw first)
 * 3. A directional arrow indicating strand
 */
function draw(ctx: GlyphRenderContext) {
  const { ctx: context, featureLayout, canvasWidth } = ctx

  drawSegmentLine(ctx)

  // Sort children so retrotransposons are drawn first (underneath other elements)
  const sortedChildren = [...featureLayout.children].sort((a, b) => {
    const aType = a.feature.get('type') as string
    const bType = b.feature.get('type') as string
    if (aType.endsWith('_retrotransposon')) {
      return -1
    } else if (bType.endsWith('_retrotransposon')) {
      return 1
    } else {
      return 0
    }
  })

  for (const childLayout of sortedChildren) {
    const childFeature = childLayout.feature
    const type = childFeature.get('type') as string
    const color = repeatColorMap[type] || '#000'
    // Retrotransposons are drawn with reduced height
    const shorten = type.endsWith('_retrotransposon')

    drawRepeatBox(context, childLayout, canvasWidth, color, shorten)
  }

  drawArrow(ctx)
}

/**
 * Match function - determines if this glyph should handle a feature
 *
 * Returns true for repeat_region features that have subfeatures
 */
function match(feature: Feature) {
  const type = feature.get('type')
  const subfeatures = feature.get('subfeatures')
  return (
    type === 'repeat_region' &&
    subfeatures !== undefined &&
    subfeatures.length > 0
  )
}

export default new GlyphType({
  name: 'RepeatRegionGlyph',
  displayName: 'Repeat Region',
  draw,
  match,
})
