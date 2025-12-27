/**
 * MatureProteinRegionGlyph - Renders CDS features with mature_protein_region_of_CDS subfeatures
 *
 * This glyph handles the case where a CDS (typically a polyprotein) contains
 * multiple mature protein regions that are cleaved from the parent protein.
 * Common in viral genomes like enteroviruses where a single polyprotein
 * is processed into multiple functional proteins (VP0, VP1, VP2, etc.)
 */
import { readConfObject } from '@jbrowse/core/configuration'
import { GlyphType } from '@jbrowse/core/pluggableElementTypes'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  GlyphFeatureLayout,
  GlyphRenderContext,
} from '@jbrowse/core/pluggableElementTypes/GlyphType'
import type { Feature } from '@jbrowse/core/util'

const matureProteinColors = [
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

function isOffScreen(left: number, width: number, canvasWidth: number) {
  return left + width < 0 || left > canvasWidth
}

function getFeature(item: { feature: Feature } | Feature): Feature {
  return 'feature' in item ? item.feature : item
}

function sortByPosition<T extends { feature: Feature } | Feature>(items: T[]) {
  return [...items].sort((a, b) => {
    const aFeat = getFeature(a)
    const bFeat = getFeature(b)
    const aStart = aFeat.get('start') as number
    const bStart = bFeat.get('start') as number
    if (aStart !== bStart) {
      return aStart - bStart
    }
    const aEnd = aFeat.get('end') as number
    const bEnd = bFeat.get('end') as number
    return bEnd - aEnd
  })
}

function drawMatureProteinBox(
  context: CanvasRenderingContext2D,
  childLayout: GlyphFeatureLayout,
  canvasWidth: number,
  color: string,
  rowTop: number,
  rowHeight: number,
  subfeatureLabels: string,
  reversed: boolean,
  arrowColor: string,
) {
  const { x: left, width, feature } = childLayout

  if (isOffScreen(left, width, canvasWidth)) {
    return
  }

  const hasLabelsBelow = subfeatureLabels === 'below'
  const padding = 1
  const boxTop = rowTop + padding
  const boxHeight = hasLabelsBelow
    ? Math.floor(rowHeight / 2) - padding
    : rowHeight - padding * 2

  context.fillStyle = color
  context.fillRect(left, boxTop, width, boxHeight)

  context.strokeStyle = 'rgba(0,0,0,0.3)'
  context.lineWidth = 1
  context.strokeRect(left, boxTop, width, boxHeight)

  // Draw strand arrow for this subfeature
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
      context.strokeStyle = arrowColor
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(p, y)
      context.lineTo(p + offset, y)
      context.stroke()

      context.fillStyle = arrowColor
      context.beginPath()
      context.moveTo(p + offset / 2, y - size / 2)
      context.lineTo(p + offset / 2, y + size / 2)
      context.lineTo(p + offset, y)
      context.closePath()
      context.fill()
    }
  }
}

function draw(ctx: GlyphRenderContext) {
  const {
    ctx: context,
    featureLayout,
    canvasWidth,
    config,
    reversed,
    theme,
  } = ctx
  const { y: top, height } = featureLayout

  const subfeatureLabels = readConfObject(config, 'subfeatureLabels') as string
  const sortedChildren = sortByPosition(featureLayout.children)
  const numRows = Math.max(1, sortedChildren.length)
  const rowHeight = height / numRows
  const arrowColor = theme.palette.text.secondary

  for (const [i, sortedChild] of sortedChildren.entries()) {
    const child = sortedChild
    const color = matureProteinColors[i % matureProteinColors.length]!
    const rowTop = top + i * rowHeight
    drawMatureProteinBox(
      context,
      child,
      canvasWidth,
      color,
      rowTop,
      rowHeight,
      subfeatureLabels,
      reversed,
      arrowColor,
    )
  }
}

function match(feature: Feature) {
  if (feature.get('type') !== 'CDS') {
    return false
  }
  const subfeatures = feature.get('subfeatures')
  return subfeatures?.some(sub => isMatureProteinType(sub.get('type'))) ?? false
}

function getChildFeatures(feature: Feature) {
  const subfeatures = feature.get('subfeatures')
  return subfeatures?.filter(sub => isMatureProteinType(sub.get('type'))) ?? []
}

function getSubfeatureMouseover(feature: Feature) {
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
}

function getHeightMultiplier(feature: Feature, config: AnyConfigurationModel) {
  const numChildren = getChildFeatures(feature).length
  if (numChildren === 0) {
    return 1
  }
  const subfeatureLabels = readConfObject(config, 'subfeatureLabels') as string
  const perRowMultiplier = subfeatureLabels === 'below' ? 2 : 1
  return numChildren * perRowMultiplier
}

export default new GlyphType({
  name: 'MatureProteinRegionGlyph',
  displayName: 'Mature Protein Region',
  draw,
  match,
  getChildFeatures,
  getHeightMultiplier,
  getSubfeatureMouseover,
})
