import { readConfObject } from '@jbrowse/core/configuration'

import { getLayoutWidth, layoutFeature } from './simpleLayout'

import type { LayoutRecord } from './types'
import type { Feature } from '@jbrowse/core/util'

const xPadding = 2
const yPadding = 5

/**
 * Compute layouts for all features before rendering
 * This is called in the worker to pre-compute collision detection
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

    // Calculate total width and height including subfeatures
    const totalWidth = getLayoutWidth(featureLayout)
    // Use total height (including label space) for collision detection
    const totalHeight = featureLayout.totalHeight

    // Get name and description using config (consistent with label display)
    const name = String(
      readConfObject(config, ['labels', 'name'], { feature }) || '',
    )
    const description = String(
      readConfObject(config, ['labels', 'description'], { feature }) || '',
    )

    // Add to collision detection layout
    // Pass feature as data (not serialized) and minimal info as serializableData
    const topPx = layout.addRect(
      feature.id(),
      feature.get('start'),
      feature.get('start') + totalWidth * bpPerPx + xPadding,
      totalHeight + yPadding,
      feature,
      {
        label: name,
        description,
        refName: feature.get('refName'),
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
