import { readConfObject } from '@jbrowse/core/configuration'

import { chooseGlyphType } from './util'
import { getSubparts } from './filterSubparts'

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
  let y = parentY

  const layout: FeatureLayout = {
    feature,
    x,
    y,
    width,
    height: actualHeight,
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
        currentY += childLayout.height
      }
      // Update total height to include all stacked children
      layout.height = currentY - parentY
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
 * Calculate total height of layout
 * For top-level features, this should return just the height since y starts at 0
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
