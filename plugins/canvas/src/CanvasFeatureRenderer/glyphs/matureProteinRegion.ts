import { readCachedConfig } from '../renderConfig.ts'
import { isOffScreen } from '../util.ts'
import { drawStrandArrowAtPosition, layoutChild } from './glyphUtils.ts'

import type { DrawContext, FeatureLayout, Glyph, LayoutArgs } from '../types.ts'
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

function getMatureProteinChildren(feature: Feature): Feature[] {
  const subfeatures = feature.get('subfeatures')
  return (
    subfeatures?.filter(sub => MATURE_PROTEIN_TYPES.has(sub.get('type'))) ?? []
  )
}

function sortByPosition(children: FeatureLayout[]) {
  return [...children].sort((a, b) => {
    const aStart = a.feature.get('start')
    const bStart = b.feature.get('start')
    if (aStart !== bStart) {
      return aStart - bStart
    }
    return b.feature.get('end') - a.feature.get('end')
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
    const { config, featureHeight, heightMultiplier, subfeatureLabels } =
      configContext

    const start = feature.get('start')
    const end = feature.get('end')
    const heightPx = readCachedConfig(featureHeight, config, 'height', feature)
    const baseHeightPx = heightPx * heightMultiplier
    const widthPx = (end - start) / bpPerPx

    const matureProteins = getMatureProteinChildren(feature)
    const children = matureProteins.map(child =>
      layoutChild(child, feature, args),
    )

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

    for (const [i, sortedChild] of sortedChildren.entries()) {
      const child = sortedChild
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
      totalLayoutHeight: totalHeight,
      totalLayoutWidth: widthPx,
      leftPadding: 0,
      children: sortedChildren,
    }
  },

  draw(ctx: CanvasRenderingContext2D, layout: FeatureLayout, dc: DrawContext) {
    const { children } = layout
    const { region, theme, canvasWidth } = dc
    const reversed = region.reversed ?? false
    const arrowColor = theme.palette.text.secondary

    for (const [i, childLayout] of children.entries()) {
      const color = MATURE_PROTEIN_COLORS[i % MATURE_PROTEIN_COLORS.length]!
      drawMatureProteinBox(
        ctx,
        childLayout,
        canvasWidth,
        color,
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
  reversed: boolean,
  arrowColor: string,
) {
  const { x: left, y: boxTop, width, height: boxHeight, feature } = childLayout

  if (isOffScreen(left, width, canvasWidth)) {
    return
  }

  ctx.fillStyle = color
  ctx.fillRect(left, boxTop, width, boxHeight)

  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 1
  ctx.strokeRect(left, boxTop, width, boxHeight)

  const strand = feature.get('strand') as number
  if (strand) {
    const centerY = boxTop + boxHeight / 2
    drawStrandArrowAtPosition(
      ctx,
      left,
      centerY,
      width,
      strand,
      reversed,
      arrowColor,
    )
  }
}
