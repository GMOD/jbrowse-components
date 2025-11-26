import { readConfObject } from '@jbrowse/core/configuration'
import { calculateLayoutBounds } from '@jbrowse/core/util'

import { createFeatureFloatingLabels } from './floatingLabels'
import { createRenderConfigContext } from './renderConfig'
import { layoutFeature } from './simpleLayout'

import type { LayoutRecord } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

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
  region: Region
  config: AnyConfigurationModel
  layout: BaseLayout<unknown>
}): LayoutRecord[] {
  const reversed = region.reversed || false
  const layoutRecords: LayoutRecord[] = []

  // Pre-read config values once to avoid repeated readConfObject calls in hot path
  // Reading config via readConfObject is expensive due to potential JEXL evaluation
  const configContext = createRenderConfigContext(config)
  const {
    displayMode,
    transcriptTypes,
    containerTypes,
    showLabels,
    showDescriptions,
    showSubfeatureLabels,
    subfeatureLabelPosition,
    fontHeight,
    labelAllowed,
  } = configContext

  for (const feature of features.values()) {
    // Create simple layout for feature and its subfeatures
    const featureLayout = layoutFeature({
      feature,
      bpPerPx,
      reversed,
      config,
      displayMode,
      transcriptTypes,
      containerTypes,
      showLabels,
      showDescriptions,
      showSubfeatureLabels,
      subfeatureLabelPosition,
      fontHeight,
      labelAllowed,
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

    // Create floating labels using the extracted helper
    const floatingLabels = createFeatureFloatingLabels({
      feature,
      config,
      configContext,
      nameColor: 'black',
      descriptionColor: 'blue',
    })

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
    //
    // Use calculateLayoutBounds to handle reversed regions correctly:
    // - Normal: extend towards higher genomic coords (visual right)
    // - Reversed: extend towards lower genomic coords (visual right when reversed)
    const featureStart = feature.get('start')
    const featureEnd = feature.get('end')
    const layoutWidthBp = totalLayoutWidth * bpPerPx
    const [layoutStart, layoutEnd] = calculateLayoutBounds(
      featureStart,
      featureEnd,
      layoutWidthBp,
      reversed,
    )

    const topPx = layout.addRect(
      feature.id(),
      layoutStart,
      layoutEnd,
      totalLayoutHeight + yPadding,
      feature,
      {
        label: name,
        description,
        refName: feature.get('refName'),
        floatingLabels,
        totalFeatureHeight,
        totalLayoutWidth, // Pass layout width in pixels for label rendering
        featureWidth: featureLayout.width, // Pass feature width for reversed region label positioning
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
