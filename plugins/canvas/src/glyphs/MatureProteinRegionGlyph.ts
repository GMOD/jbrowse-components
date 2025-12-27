/**
 * MatureProteinRegionGlyph - Renders CDS features with mature_protein_region_of_CDS subfeatures
 *
 * This glyph handles the case where a CDS (typically a polyprotein) contains
 * multiple mature protein regions that are cleaved from the parent protein.
 * Common in viral genomes like enteroviruses where a single polyprotein
 * is processed into multiple functional proteins (VP0, VP1, VP2, etc.)
 */
import { GlyphType } from '@jbrowse/core/pluggableElementTypes'
import { measureText } from '@jbrowse/core/util'

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

const LABEL_FONT_SIZE = 10
const MIN_WIDTH_FOR_LABEL = 20

interface TieredLayout {
  layout: GlyphFeatureLayout
  tier: number
  colorIndex: number
}

function isOffScreen(left: number, width: number, canvasWidth: number) {
  return left + width < 0 || left > canvasWidth
}

function assignTiers(children: GlyphFeatureLayout[]): TieredLayout[] {
  const sorted = [...children].sort((a, b) => {
    const aStart = a.feature.get('start') as number
    const bStart = b.feature.get('start') as number
    if (aStart !== bStart) {
      return aStart - bStart
    }
    const aEnd = a.feature.get('end') as number
    const bEnd = b.feature.get('end') as number
    return bEnd - aEnd
  })

  const tiered: TieredLayout[] = []
  const tierEnds: number[] = []
  let lastAssignedTier = -1

  for (let i = 0; i < sorted.length; i++) {
    const child = sorted[i]!
    const start = child.feature.get('start') as number
    const end = child.feature.get('end') as number

    const availableTiers: number[] = []
    for (let t = 0; t < tierEnds.length; t++) {
      if (tierEnds[t]! <= start) {
        availableTiers.push(t)
      }
    }

    let assignedTier: number
    if (availableTiers.length === 0) {
      assignedTier = tierEnds.length
      tierEnds.push(end)
    } else {
      const preferredTier = availableTiers.find(t => t !== lastAssignedTier)
      assignedTier = preferredTier ?? availableTiers[0]!
      tierEnds[assignedTier] = end
    }

    lastAssignedTier = assignedTier
    tiered.push({ layout: child, tier: assignedTier, colorIndex: i })
  }

  return tiered
}

function getFeatureLabel(feature: Feature) {
  const product = feature.get('product') as string | undefined
  const proteinId = feature.get('protein_id') as string | undefined
  if (product && proteinId) {
    return `${product} (${proteinId})`
  }
  if (product) {
    return product
  }
  if (proteinId) {
    return proteinId
  }
  return (feature.get('name') as string) || (feature.get('id') as string) || ''
}

function truncateLabel(label: string, maxWidth: number) {
  if (measureText(label, LABEL_FONT_SIZE) <= maxWidth) {
    return label
  }
  let truncated = label
  while (truncated.length > 0 && measureText(truncated + '…', LABEL_FONT_SIZE) > maxWidth) {
    truncated = truncated.slice(0, -1)
  }
  return truncated.length > 0 ? truncated + '…' : ''
}

function drawMatureProteinBox(
  context: CanvasRenderingContext2D,
  childLayout: GlyphFeatureLayout,
  canvasWidth: number,
  color: string,
  tierTop: number,
  tierHeight: number,
) {
  const { x: left, width, feature } = childLayout

  if (isOffScreen(left, width, canvasWidth)) {
    return
  }

  const padding = 1
  const boxTop = tierTop + padding
  const boxHeight = tierHeight - padding * 2

  context.fillStyle = color
  context.fillRect(left, boxTop, width, boxHeight)

  context.strokeStyle = 'rgba(0,0,0,0.3)'
  context.lineWidth = 1
  context.strokeRect(left, boxTop, width, boxHeight)

  if (width >= MIN_WIDTH_FOR_LABEL) {
    const label = getFeatureLabel(feature)
    console.log('Label debug:', { width, label, boxHeight })
    if (label) {
      const maxLabelWidth = width - 4
      const truncatedLabel = truncateLabel(label, maxLabelWidth)
      if (truncatedLabel) {
        context.font = `${LABEL_FONT_SIZE}px sans-serif`
        context.fillStyle = 'black'
        context.textAlign = 'left'
        context.textBaseline = 'middle'
        const textX = left + 2
        const textY = boxTop + boxHeight / 2
        context.fillText(truncatedLabel, textX, textY)
      }
    }
  }
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

function draw(ctx: GlyphRenderContext) {
  const { ctx: context, featureLayout, canvasWidth } = ctx
  const { y: top, height } = featureLayout

  const tieredChildren = assignTiers(featureLayout.children)
  const numTiers = Math.max(1, ...tieredChildren.map(t => t.tier + 1))
  const tierHeight = height / numTiers

  for (const { layout, tier, colorIndex } of tieredChildren) {
    const color = matureProteinColors[colorIndex % matureProteinColors.length]!
    const tierTop = top + tier * tierHeight
    drawMatureProteinBox(context, layout, canvasWidth, color, tierTop, tierHeight)
  }

  drawArrow(ctx)
}

function match(feature: Feature) {
  const type = feature.get('type')
  if (type !== 'CDS') {
    return false
  }
  const subfeatures = feature.get('subfeatures') as Feature[] | undefined
  if (!subfeatures?.length) {
    return false
  }
  return subfeatures.some(sub => {
    const subType = sub.get('type') as string
    return (
      subType === 'mature_protein_region_of_CDS' ||
      subType === 'mature_protein_region'
    )
  })
}

function getChildFeatures(feature: Feature) {
  const subfeatures = feature.get('subfeatures') as Feature[] | undefined
  if (!subfeatures) {
    return []
  }
  return subfeatures.filter(sub => {
    const subType = sub.get('type') as string
    return (
      subType === 'mature_protein_region_of_CDS' ||
      subType === 'mature_protein_region'
    )
  })
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

function getHeightMultiplier(feature: Feature) {
  const children = getChildFeatures(feature)
  if (children.length === 0) {
    return 1
  }

  const sorted = [...children].sort((a, b) => {
    const aStart = a.get('start') as number
    const bStart = b.get('start') as number
    if (aStart !== bStart) {
      return aStart - bStart
    }
    const aEnd = a.get('end') as number
    const bEnd = b.get('end') as number
    return bEnd - aEnd
  })

  const tierEnds: number[] = []
  let lastAssignedTier = -1

  for (const child of sorted) {
    const start = child.get('start') as number
    const end = child.get('end') as number

    const availableTiers: number[] = []
    for (let t = 0; t < tierEnds.length; t++) {
      if (tierEnds[t]! <= start) {
        availableTiers.push(t)
      }
    }

    let assignedTier: number
    if (availableTiers.length === 0) {
      assignedTier = tierEnds.length
      tierEnds.push(end)
    } else {
      const preferredTier = availableTiers.find(t => t !== lastAssignedTier)
      assignedTier = preferredTier ?? availableTiers[0]!
      tierEnds[assignedTier] = end
    }

    lastAssignedTier = assignedTier
  }

  return Math.max(1, tierEnds.length)
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
