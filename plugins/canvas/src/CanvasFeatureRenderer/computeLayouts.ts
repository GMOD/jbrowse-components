import { readConfObject } from '@jbrowse/core/configuration'

import { layoutFeature } from './simpleLayout'

import type { LayoutRecord } from './types'
import type { Feature } from '@jbrowse/core/util'

const xPadding = 0
const yPadding = 5

/**
 * Compute layouts for all features before rendering
 * This is called in the worker to pre-compute collision detection
 *
 * LAYOUT SYSTEM OVERVIEW:
 * 1. Each feature gets a layout rect for collision detection
 * 2. totalLayoutWidth = max(feature width, label width) in pixels
 *    - Ensures enough horizontal space for the wider of feature or label
 *    - Converted to base pairs using bpPerPx (scales with zoom level)
 * 3. totalLayoutHeight = feature height + label height in pixels
 *    - Ensures enough vertical space to prevent label overlap between rows
 * 4. Labels are rendered below features as floating overlays
 *    - Positioned at feature start (clamped to viewport)
 *    - Can extend horizontally past feature bounds
 *    - Cannot overlap vertically (prevented by totalLayoutHeight)
 */
export function computeLayouts({
  features,
  bpPerPx,
  region,
  config,
  layout,
}: {
  features: Map<string, Feature>
  bpPerPx: number
  region: any
  config: any
  layout: any
}): LayoutRecord[] {
  const reversed = region.reversed || false
  const layoutRecords: LayoutRecord[] = []

  for (const feature of features.values()) {
    // Create simple layout for feature and its subfeatures
    const featureLayout = layoutFeature({
      feature,
      bpPerPx,
      reversed,
      config,
    })

    // Extract layout dimensions from the feature layout tree
    // totalLayoutWidth: max(feature width, label width) in pixels - used for collision detection
    // totalLayoutHeight: feature height + label height in pixels - used for vertical spacing
    // totalFeatureHeight: visual height of feature only (without label space) - used for positioning labels
    const totalLayoutWidth = featureLayout.totalLayoutWidth
    const totalLayoutHeight = featureLayout.totalLayoutHeight
    const totalFeatureHeight = featureLayout.totalFeatureHeight

    // Get name and description using config (consistent with label display)
    const name = String(
      readConfObject(config, ['labels', 'name'], { feature }) || '',
    )
    const description = String(
      readConfObject(config, ['labels', 'description'], { feature }) || '',
    )

    // Pre-calculate label config
    const showLabels = readConfObject(config, 'showLabels')
    const showDescriptions = readConfObject(config, 'showDescriptions')
    const fontHeight = readConfObject(config, ['labels', 'fontSize'], {
      feature,
    }) as number

    // Calculate floating labels with relative Y positions (positive = below feature)
    const shouldShowLabel = /\S/.test(name) && showLabels
    const shouldShowDescription = /\S/.test(description) && showDescriptions

    const floatingLabels: {
      text: string
      relativeY: number
      color: string
    }[] = []

    if (shouldShowLabel && shouldShowDescription) {
      floatingLabels.push(
        {
          text: name,
          relativeY: 0,
          color: 'black',
        },
        {
          text: description,
          relativeY: fontHeight,
          color: 'blue',
        },
      )
    } else if (shouldShowLabel) {
      floatingLabels.push({
        text: name,
        relativeY: 0,
        color: 'black',
      })
    } else if (shouldShowDescription) {
      floatingLabels.push({
        text: description,
        relativeY: 0,
        color: 'blue',
      })
    }

    // Add rect to layout for collision detection
    // COLLISION DETECTION STRATEGY:
    // - Horizontal (left-right): Convert totalLayoutWidth (pixels) to base pairs
    //   This reserves genomic space equal to max(feature width, label width) at current zoom
    //   Prevents features from being placed on the same row if their extents (including labels) overlap
    // - Vertical (top-bottom): Use totalLayoutHeight (includes label height + yPadding)
    //   This ensures features on different rows don't have overlapping labels
    //
    // Note: layoutWidthBp scales with zoom (same pixel width = different bp at different zooms)
    // This is correct behavior - labels need more genomic space when zoomed in
    const featureStart = feature.get('start')
    const layoutWidthBp = totalLayoutWidth * bpPerPx
    const topPx = layout.addRect(
      feature.id(),
      featureStart,
      featureStart + layoutWidthBp,
      totalLayoutHeight + yPadding,
      feature,
      {
        label: name,
        description,
        refName: feature.get('refName'),
        floatingLabels,
        totalFeatureHeight,
        totalLayoutWidth, // Pass layout width in pixels for label rendering
      },
    )

    if (topPx !== null) {
      layoutRecords.push({
        feature,
        layout: featureLayout,
        topPx,
      })
    }
  }

  return layoutRecords
}
