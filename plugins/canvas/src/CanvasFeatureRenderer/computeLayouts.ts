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

    // Calculate total layout width and height including label space
    const totalLayoutWidth = getLayoutWidth(featureLayout)
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

    const floatingLabels: Array<{
      text: string
      relativeY: number
      color: string
    }> = []

    if (shouldShowLabel && shouldShowDescription) {
      floatingLabels.push({
        text: name,
        relativeY: 0,
        color: 'black',
      })
      floatingLabels.push({
        text: description,
        relativeY: fontHeight,
        color: 'blue',
      })
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

    // Add rect to layout with floating labels
    const featureStart = feature.get('start')
    const topPx = layout.addRect(
      feature.id(),
      featureStart,
      featureStart + totalLayoutWidth * bpPerPx + xPadding,
      totalLayoutHeight + yPadding,
      feature,
      {
        label: name,
        description,
        refName: feature.get('refName'),
        floatingLabels,
        totalFeatureHeight,
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
