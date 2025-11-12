import { readConfObject } from '@jbrowse/core/configuration'
import { measureText } from '@jbrowse/core/util'

import { getSubparts } from './filterSubparts'
import { chooseGlyphType } from './util'

import type { FeatureLayout } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

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
}): FeatureLayout {
  const { feature, bpPerPx, reversed, config, parentX = 0, parentY = 0 } = args
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
    totalHeight: actualHeight, // Will be updated below
    children: [],
  }

  // Handle subfeatures
  const subfeatures = feature.get('subfeatures') || []
  if (subfeatures.length > 0 && displayMode !== 'reducedRepresentation') {
    if (glyphType === 'Subfeatures') {
      // Stack subfeatures vertically (for genes with multiple transcripts)
      let currentY = parentY
      for (const subfeature of subfeatures) {
        const childLayout = layoutFeature({
          feature: subfeature,
          bpPerPx,
          reversed,
          config,
          parentX: x,
          parentY: currentY,
        })
        layout.children.push(childLayout)
        // Use totalHeight for stacking to include label space
        currentY += childLayout.totalHeight
      }
      // Update heights to include all stacked children
      const totalStackedHeight = currentY - parentY
      layout.height = totalStackedHeight
      layout.totalHeight = totalStackedHeight
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
        })
        layout.children.push(childLayout)
      }
    }
  }

  // Add extra height for labels (name and description)
  // Labels are drawn by floating label system, but we need to reserve space
  const labelAllowed = displayMode !== 'collapsed'
  if (labelAllowed && !parentFeature) {
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
    if (shouldShowName) {
      extraHeight += fontHeight
    }
    if (shouldShowDescription) {
      extraHeight += fontHeight
    }

    // Add the label height to totalHeight only (not to visual height)
    layout.totalHeight = layout.height + extraHeight
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
 * Calculate total width of layout
 * For top-level features, this should return just the width since x starts at 0
 */
export function getLayoutWidth(layout: FeatureLayout): number {
  if (layout.children.length === 0) {
    return layout.width
  }

  // For features with children, find the max x+width among all children
  let maxRight = layout.width
  for (const child of layout.children) {
    const childRight = child.x + getLayoutWidth(child)
    maxRight = Math.max(maxRight, childRight)
  }
  return maxRight
}

/**
 * Calculate total height of layout including label space
 * For top-level features, this should return totalHeight
 */
export function getLayoutHeight(layout: FeatureLayout): number {
  if (layout.children.length === 0) {
    return layout.totalHeight
  }

  // For features with children, find the max y+totalHeight among all children
  let maxBottom = layout.totalHeight
  for (const child of layout.children) {
    const childBottom = child.y + getLayoutHeight(child)
    maxBottom = Math.max(maxBottom, childBottom)
  }
  return maxBottom
}
