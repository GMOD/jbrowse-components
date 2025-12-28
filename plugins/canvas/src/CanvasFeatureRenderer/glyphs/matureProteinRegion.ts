import { readCachedConfig } from '../renderConfig'
import { isOffScreen } from '../util'

import type { DrawContext, FeatureLayout, Glyph, LayoutArgs } from '../types'
import type { Feature } from '@jbrowse/core/util'

const MATURE_PROTEIN_COLORS = [
  '#1f77b4', // blue
  '#ff7f0e', // orange
  '#2ca02c', // green
  '#d62728', // red
  '#9467bd', // purple
  '#8c564b', // brown
  '#e377c2', // pink
  '#7f7f7f', // gray
  '#bcbd22', // olive
  '#17becf', // cyan
  '#aec7e8', // light blue
  '#ffbb78', // light orange
]

const MATURE_PROTEIN_TYPES = new Set([
  'mature_protein_region_of_CDS',
  'mature_protein_region',
])

function isMatureProteinType(type: string) {
  return MATURE_PROTEIN_TYPES.has(type)
}

function getMatureProteinChildren(feature: Feature): Feature[] {
  const subfeatures = feature.get('subfeatures') as Feature[] | undefined
  return subfeatures?.filter(sub => isMatureProteinType(sub.get('type'))) ?? []
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

function sortByPosition(children: FeatureLayout[]) {
  return [...children].sort((a, b) => {
    const aStart = a.feature.get('start')
    const bStart = b.feature.get('start')
    if (aStart !== bStart) {
      return aStart - bStart
    }
    const aEnd = a.feature.get('end')
    const bEnd = b.feature.get('end')
    return bEnd - aEnd
  })
}

export const matureProteinRegionGlyph: Glyph = {
  type: 'MatureProteinRegion',
  hasIndexableChildren: true,

  match(feature) {
    if (feature.get('type') !== 'CDS') {
      return false
    }
    return getMatureProteinChildren(feature).length > 0
  },

  getSubfeatureMouseover(feature: Feature) {
    const product = feature.get('product') as string | undefined
    const proteinId = feature.get('protein_id') as string | undefined
    const parts: string[] = []
    if (product) {
      parts.push(product)
    }
    if (proteinId) {
      parts.push(`(${proteinId})`)
    }
    return parts.length > 0 ? parts.join(' ') : undefined
  },

  layout(args: LayoutArgs): FeatureLayout {
    const { feature, bpPerPx, configContext } = args
    const { config, displayMode, featureHeight, subfeatureLabels } = configContext

    const featureStart = feature.get('start') as number
    const featureEnd = feature.get('end') as number
    const heightPx = readCachedConfig(featureHeight, config, 'height', feature)
    const baseHeightPx = displayMode === 'compact' ? heightPx / 2 : heightPx
    const widthPx = (featureEnd - featureStart) / bpPerPx

    const matureProteins = getMatureProteinChildren(feature)
    const children = matureProteins.map(child => layoutChild(child, feature, args))

    // Sort children by position and assign row y-positions
    const sortedChildren = sortByPosition(children)
    const numRows = Math.max(1, sortedChildren.length)
    const perRowMultiplier = subfeatureLabels === 'below' ? 2 : 1
    const rowHeight = baseHeightPx * perRowMultiplier
    const totalHeight = rowHeight * numRows

    // Position each child in its row, accounting for padding and label space
    const padding = 1
    const boxHeight =
      subfeatureLabels === 'below'
        ? Math.floor(rowHeight / 2) - padding
        : rowHeight - padding * 2

    for (let i = 0; i < sortedChildren.length; i++) {
      const child = sortedChildren[i]!
      // Position at actual box location (with padding offset)
      child.y = i * rowHeight + padding
      child.height = boxHeight
      child.totalLayoutHeight = rowHeight
    }

    return {
      feature,
      glyphType: 'MatureProteinRegion',
      x: 0,
      y: 0,
      width: widthPx,
      height: totalHeight,
      totalFeatureHeight: totalHeight,
      totalLayoutHeight: totalHeight,
      totalLayoutWidth: widthPx,
      leftPadding: 0,
      children: sortedChildren,
    }
  },

  draw(ctx: CanvasRenderingContext2D, layout: FeatureLayout, dc: DrawContext) {
    const { children } = layout
    const { region, configContext, theme, canvasWidth } = dc
    const { subfeatureLabels } = configContext
    const reversed = region.reversed ?? false
    const arrowColor = theme.palette.text.secondary

    // Children are already sorted and positioned by layout()
    for (const [i, childLayout] of children.entries()) {
      const color = MATURE_PROTEIN_COLORS[i % MATURE_PROTEIN_COLORS.length]!

      drawMatureProteinBox(
        ctx,
        childLayout,
        canvasWidth,
        color,
        subfeatureLabels,
        reversed,
        arrowColor,
      )
    }
  },
}

function drawMatureProteinBox(
  ctx: CanvasRenderingContext2D,
  childLayout: FeatureLayout,
  canvasWidth: number,
  color: string,
  subfeatureLabels: string,
  reversed: boolean,
  arrowColor: string,
) {
  // Layout already accounts for padding and label space
  const { x: left, y: boxTop, width, height: boxHeight, feature } = childLayout

  if (isOffScreen(left, width, canvasWidth)) {
    return
  }

  ctx.fillStyle = color
  ctx.fillRect(left, boxTop, width, boxHeight)

  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 1
  ctx.strokeRect(left, boxTop, width, boxHeight)

  // Draw strand arrow
  const strand = feature.get('strand') as number
  if (strand) {
    const size = 5
    const reverseFlip = reversed ? -1 : 1
    const offset = 7 * strand * reverseFlip
    const y = boxTop + boxHeight / 2

    const p =
      strand * reverseFlip === -1
        ? left
        : strand * reverseFlip === 1
          ? left + width
          : null

    if (p !== null) {
      ctx.strokeStyle = arrowColor
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(p, y)
      ctx.lineTo(p + offset, y)
      ctx.stroke()

      ctx.fillStyle = arrowColor
      ctx.beginPath()
      ctx.moveTo(p + offset / 2, y - size / 2)
      ctx.lineTo(p + offset / 2, y + size / 2)
      ctx.lineTo(p + offset, y)
      ctx.closePath()
      ctx.fill()
    }
  }
}
