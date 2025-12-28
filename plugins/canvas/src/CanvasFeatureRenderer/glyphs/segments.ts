import { readCachedConfig } from '../renderConfig'
import { drawChevrons } from '../drawChevrons'
import { getStrokeColor, isOffScreen } from '../util'
import { boxGlyph } from './box'
import { cdsGlyph } from './cds'

import type { DrawContext, FeatureLayout, Glyph, LayoutArgs } from '../types'
import type { Feature } from '@jbrowse/core/util'

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

  const childStartBp = child.get('start')
  const childEndBp = child.get('end')
  const parentStartBp = parentFeature.get('start')
  const parentEndBp = parentFeature.get('end')

  const widthPx = (childEndBp - childStartBp) / bpPerPx

  // Position relative to parent (in pixels)
  const offsetBp = reversed
    ? parentEndBp - childEndBp
    : childStartBp - parentStartBp
  const xRelativePx = offsetBp / bpPerPx

  const childType = child.get('type')
  const glyphType = childType === 'CDS' ? 'CDS' : 'Box'

  return {
    feature: child,
    glyphType,
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

export const segmentsGlyph: Glyph = {
  type: 'Segments',

  match(feature, configContext) {
    const type = feature.get('type')
    if (type === 'CDS') {
      return false
    }
    const subfeatures = feature.get('subfeatures')
    if (!subfeatures?.length) {
      return false
    }
    const { transcriptTypes, containerTypes } = configContext
    // Not a coding transcript (those use ProcessedTranscript)
    if (transcriptTypes.includes(type)) {
      const hasCDS = subfeatures.some(
        (f: Feature) => f.get('type') === 'CDS',
      )
      if (hasCDS) {
        return false
      }
    }
    // Not a container (gene)
    if (containerTypes.includes(type)) {
      return false
    }
    // Not a top-level feature with nested subfeatures
    const isTopLevel = !feature.parent?.()
    const hasNestedSubfeatures = subfeatures.some(
      (f: Feature) => f.get('subfeatures')?.length,
    )
    if (isTopLevel && hasNestedSubfeatures) {
      return false
    }
    return true
  },

  layout(args: LayoutArgs): FeatureLayout {
    const { feature, bpPerPx, reversed, configContext } = args
    const { config, displayMode, featureHeight } = configContext

    const featureBp = {
      start: feature.get('start') as number,
      end: feature.get('end') as number,
    }
    const heightPx = readCachedConfig(featureHeight, config, 'height', feature)
    const baseHeightPx = displayMode === 'compact' ? heightPx / 2 : heightPx
    const widthPx = (featureBp.end - featureBp.start) / bpPerPx

    const strand = feature.get('strand') as number
    const arrowPadding = getStrandArrowPadding(strand, reversed)

    // Layout children
    const subfeatures = (feature.get('subfeatures') || []) as Feature[]
    const children = subfeatures.map(child =>
      layoutChild(child, feature, args),
    )

    return {
      feature,
      glyphType: 'Segments',
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
    const { region, bpPerPx, configContext, theme, canvasWidth } = dc
    const { config, displayDirectionalChevrons } = configContext
    const reversed = region.reversed ?? false

    const left = layout.x
    const width = layout.width
    const top = layout.y
    const height = layout.height

    if (isOffScreen(left, width, canvasWidth)) {
      return
    }

    // Draw connecting line
    const color2 = getStrokeColor({ feature, config, configContext, theme })
    const y = top + height / 2

    ctx.strokeStyle = color2
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(left + width, y)
    ctx.stroke()

    // Draw chevrons if enabled
    if (displayDirectionalChevrons) {
      const strand = feature.get('strand') as number
      if (strand) {
        const effectiveStrand = reversed ? -strand : strand
        drawChevrons(ctx, left, y, width, effectiveStrand, color2)
      }
    }

    // Draw children
    for (const childLayout of children) {
      // Adjust child position to be absolute
      const adjustedChild = {
        ...childLayout,
        x: left + childLayout.x,
        y: top + childLayout.y,
      }
      if (childLayout.glyphType === 'CDS') {
        cdsGlyph.draw(ctx, adjustedChild, dc)
      } else {
        boxGlyph.draw(ctx, adjustedChild, dc)
      }
    }

    // Draw arrow
    drawArrow(ctx, layout, dc)
  },
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  layout: FeatureLayout,
  dc: DrawContext,
) {
  const { feature } = layout
  const { region, configContext, theme, canvasWidth } = dc
  const { config } = configContext
  const reversed = region.reversed ?? false

  const left = layout.x
  const width = layout.width

  if (isOffScreen(left, width, canvasWidth)) {
    return
  }

  const strand = feature.get('strand')
  if (!strand) {
    return
  }

  const size = 5
  const reverseFlip = reversed ? -1 : 1
  const offset = 7 * strand * reverseFlip
  const top = layout.y
  const height = layout.height
  const y = top + height / 2

  const color2 = getStrokeColor({ feature, config, configContext, theme })
  const p =
    strand * reverseFlip === -1
      ? left
      : strand * reverseFlip === 1
        ? left + width
        : null

  if (p !== null) {
    ctx.strokeStyle = color2
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(p, y)
    ctx.lineTo(p + offset, y)
    ctx.stroke()

    ctx.fillStyle = color2
    ctx.strokeStyle = color2
    ctx.beginPath()
    ctx.moveTo(p + offset / 2, y - size / 2)
    ctx.lineTo(p + offset / 2, y + size / 2)
    ctx.lineTo(p + offset, y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
}
