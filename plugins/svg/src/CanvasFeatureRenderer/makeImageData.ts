import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import {
  bpToPx,
  forEachWithStopTokenCheck,
  measureText,
} from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'

import { drawFeature } from './drawFeature'
import { getLayoutHeight, getLayoutWidth, layoutFeature } from './simpleLayout'

import type { LayoutRecord, RenderArgs } from './types'
import type { Feature } from '@jbrowse/core/util'

const xPadding = 3
const yPadding = 5

/**
 * Render features to a canvas context and return spatial index data
 */
export function makeImageData({
  ctx,
  layoutRecords,
  renderArgs,
}: {
  ctx: CanvasRenderingContext2D
  layoutRecords: LayoutRecord[]
  renderArgs: RenderArgs
}) {
  const { config, bpPerPx, regions, theme: configTheme, stopToken } = renderArgs
  const region = regions[0]!
  const theme = createJBrowseTheme(configTheme)
  const displayMode = readConfObject(config, 'displayMode') as string
  const canvasWidth = (region.end - region.start) / bpPerPx

  const coords: number[] = []
  const items: { feature: Feature; type: string }[] = []

  // Set default canvas styles
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  forEachWithStopTokenCheck(layoutRecords, stopToken, record => {
    const { feature, layout, topPx } = record

    // Adjust layout position to absolute coordinates
    const start = feature.get(region.reversed ? 'end' : 'start')
    const startPx = bpToPx(start, region, bpPerPx)

    // Create adjusted layout with absolute positions
    const adjustedLayout = {
      ...layout,
      x: startPx + layout.x,
      y: topPx + layout.y,
      height: layout.height, // Visual height (what gets drawn)
      totalHeight: layout.totalHeight, // Total with label space
      totalWidth: layout.totalWidth, // Total with label width
      children: adjustChildPositions(layout.children, startPx, topPx),
    }

    const result = drawFeature({
      ctx,
      feature,
      featureLayout: adjustedLayout,
      region,
      bpPerPx,
      config,
      theme,
      reversed: region.reversed || false,
      topLevel: true,
      canvasWidth,
    })

    coords.push(...result.coords)
    items.push(...result.items)
  })

  function adjustChildPositions(
    children: any[],
    xOffset: number,
    yOffset: number,
  ): any[] {
    return children.map(child => ({
      ...child,
      x: child.x + xOffset,
      y: child.y + yOffset,
      height: child.height, // Keep original visual height
      totalHeight: child.totalHeight, // Keep total height with labels
      totalWidth: child.totalWidth, // Keep total width with labels
      children: adjustChildPositions(child.children, xOffset, yOffset),
    }))
  }

  // Create spatial index
  const flatbush = new Flatbush(Math.max(items.length, 1))
  if (coords.length) {
    for (let i = 0; i < coords.length; i += 4) {
      flatbush.add(coords[i]!, coords[i + 1]!, coords[i + 2], coords[i + 3])
    }
  } else {
    flatbush.add(0, 0, 0, 0)
  }
  flatbush.finish()

  return {
    flatbush: flatbush.data,
    items,
  }
}

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

    // Add to collision detection layout
    const topPx = layout.addRect(
      feature.id(),
      feature.get('start'),
      feature.get('start') + totalWidth * bpPerPx + xPadding * bpPerPx,
      totalHeight + yPadding,
      feature,
      {
        label: feature.get('name') || feature.get('id'),
        description: feature.get('description') || feature.get('note'),
        refName: feature.get('refName'),
        serializableData: {
          name: feature.get('name') || feature.get('id'),
          description: feature.get('description') || feature.get('note'),
        },
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
