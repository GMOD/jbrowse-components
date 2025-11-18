import { readConfObject } from '@jbrowse/core/configuration'
import { measureText } from '@jbrowse/core/util'

import { getSubparts } from './filterSubparts'
import { chooseGlyphType } from './util'

import type { FeatureLayout } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

// Padding between transcripts in pixels
const TRANSCRIPT_PADDING = 2

/**
 * Create layout for a feature and its subfeatures using simple coordinate tracking
 */
export function layoutFeature(args: {
  feature: Feature
  bpPerPx: number
  reversed: boolean
  config: AnyConfigurationModel
  parentX?: number
  parentY?: number
  isNested?: boolean
}): FeatureLayout {
  const {
    feature,
    bpPerPx,
    reversed,
    config,
    parentX = 0,
    parentY = 0,
    isNested = false,
  } = args
  const displayMode = readConfObject(config, 'displayMode') as string
  const glyphType = chooseGlyphType({ feature, config })

  // Calculate x position
  const parentFeature = feature.parent()
  let x = parentX
  if (parentFeature) {
    const relativeX = reversed
      ? parentFeature.get('end') - feature.get('end')
      : feature.get('start') - parentFeature.get('start')
    x = parentX + relativeX / bpPerPx
  }

  // Calculate dimensions
  const height = readConfObject(config, 'height', { feature }) as number
  const actualHeight = displayMode === 'compact' ? height / 2 : height
  const width = (feature.get('end') - feature.get('start')) / bpPerPx

  // Start with feature at parent's y position
  const y = parentY

  const layout: FeatureLayout = {
    feature,
    x,
    y,
    width,
    height: actualHeight,
    totalFeatureHeight: actualHeight, // Visual height (will be updated for stacked children)
    totalLayoutHeight: actualHeight, // Layout height including label space (will be updated below)
    totalLayoutWidth: width, // Layout width including label space (will be updated below)
    children: [],
  }

  // Handle subfeatures
  const subfeatures = feature.get('subfeatures') || []
  if (subfeatures.length > 0 && displayMode !== 'reducedRepresentation') {
    if (glyphType === 'Subfeatures') {
      // Stack subfeatures vertically (for genes with multiple transcripts)
      let currentY = parentY
      for (let i = 0; i < subfeatures.length; i++) {
        const subfeature = subfeatures[i]!
        const childLayout = layoutFeature({
          feature: subfeature,
          bpPerPx,
          reversed,
          config,
          parentX: x,
          parentY: currentY,
          isNested: true,
        })
        layout.children.push(childLayout)
        // Use visual height for stacking (not totalHeight with label space)
        currentY += childLayout.height
        // Add padding between transcripts (but not after the last one)
        if (i < subfeatures.length - 1) {
          currentY += TRANSCRIPT_PADDING
        }
      }
      // Update heights to include all stacked children
      const totalStackedHeight = currentY - parentY
      layout.height = totalStackedHeight
      layout.totalFeatureHeight = totalStackedHeight
      layout.totalLayoutHeight = totalStackedHeight
    } else if (glyphType === 'ProcessedTranscript') {
      // Overlay subfeatures (CDS, UTR on transcript)
      const subparts = getSubparts(feature, config)
      for (const subfeature of subparts) {
        const childLayout = layoutFeature({
          feature: subfeature,
          bpPerPx,
          reversed,
          config,
          parentX: x,
          parentY,
          isNested: true,
        })
        layout.children.push(childLayout)
      }
    } else {
      // Overlay subfeatures (default for Segments, etc.)
      for (const subfeature of subfeatures) {
        const childLayout = layoutFeature({
          feature: subfeature,
          bpPerPx,
          reversed,
          config,
          parentX: x,
          parentY,
          isNested: true,
        })
        layout.children.push(childLayout)
      }
    }
  }

  // Add extra height and width for labels (name and description)
  // Labels are drawn by floating label system, but we need to reserve space
  const labelAllowed = displayMode !== 'collapsed'
  if (labelAllowed && !isNested) {
    // Only add label space for top-level features (not nested subfeatures)
    const showLabels = readConfObject(config, 'showLabels')
    const showDescriptions = readConfObject(config, 'showDescriptions')
    const fontHeight = readConfObject(config, ['labels', 'fontSize'], {
      feature,
    })

    const name = String(
      readConfObject(config, ['labels', 'name'], { feature }) || '',
    )
    const shouldShowName = /\S/.test(name) && showLabels

    const description = String(
      readConfObject(config, ['labels', 'description'], { feature }) || '',
    )
    const shouldShowDescription = /\S/.test(description) && showDescriptions

    let extraHeight = 0
    let maxLabelWidth = 0
    if (shouldShowName) {
      extraHeight += fontHeight
      maxLabelWidth = Math.max(maxLabelWidth, measureText(name, fontHeight))
    }
    if (shouldShowDescription) {
      extraHeight += fontHeight
      maxLabelWidth = Math.max(
        maxLabelWidth,
        measureText(description, fontHeight),
      )
    }

    // totalFeatureHeight stays as visual height (without labels)
    // Add label height to totalLayoutHeight for vertical collision detection
    layout.totalLayoutHeight = layout.totalFeatureHeight + extraHeight

    // IMPORTANT: totalLayoutWidth is the MAX of feature width or label width, not the sum.
    // Labels are displayed below the feature, horizontally aligned with the feature start
    // (but clamped to stay within the viewport). The layout width determines the horizontal
    // space needed for collision detection:
    // 1. Short features with long labels: layout width = label width (label may extend past feature)
    // 2. Long features with short labels: layout width = feature width (label fits within)
    // The collision detection uses this width to prevent labels from overlapping vertically
    // when features are stacked, while allowing horizontal label overlap across rows.
    layout.totalLayoutWidth = Math.max(layout.width, maxLabelWidth)
  }

  return layout
}

/**
 * Get layout for a specific feature by ID from the tree
 */
export function findFeatureLayout(
  layout: FeatureLayout,
  featureId: string,
): FeatureLayout | null {
  if (layout.feature.id() === featureId) {
    return layout
  }
  for (const child of layout.children) {
    const found = findFeatureLayout(child, featureId)
    if (found) {
      return found
    }
  }
  return null
}

/**
 * Calculate total layout width including label width
 * For top-level features, this should return totalLayoutWidth
 */
export function getLayoutWidth(layout: FeatureLayout): number {
  if (layout.children.length === 0) {
    return layout.totalLayoutWidth
  }

  // For features with children, find the max x+totalLayoutWidth among all children
  let maxRight = layout.totalLayoutWidth
  for (const child of layout.children) {
    const childRight = child.x + getLayoutWidth(child)
    maxRight = Math.max(maxRight, childRight)
  }
  return maxRight
}

/**
 * Calculate visual height of layout for label positioning
 * Always returns visual height (without label space)
 */
export function getLayoutHeight(layout: FeatureLayout): number {
  if (layout.children.length === 0) {
    return layout.height
  }

  // For features with children, find the max y+height among all children
  let maxBottom = layout.height
  for (const child of layout.children) {
    const childBottom = child.y + getLayoutHeight(child)
    maxBottom = Math.max(maxBottom, childBottom)
  }
  return maxBottom
}
