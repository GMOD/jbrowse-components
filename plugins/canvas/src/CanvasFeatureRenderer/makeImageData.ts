import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { bpToPx } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { drawFeature } from './drawFeature'
import { buildChildrenIndex, convertToCanvasCoords } from './layoutUtils'

import type { RenderConfigContext } from './renderConfig'
import type {
  DrawContext,
  FlatbushItem,
  LayoutRecord,
  RenderArgs,
  SubfeatureInfo,
} from './types'

function buildFlatbush(coords: number[], count: number) {
  const fb = new Flatbush(Math.max(count, 1))
  if (coords.length) {
    for (let i = 0; i < coords.length; i += 4) {
      fb.add(coords[i]!, coords[i + 1]!, coords[i + 2], coords[i + 3])
    }
  } else {
    fb.add(0, 0, 0, 0)
  }
  fb.finish()
  return fb
}

/**
 * Phase 2: Render all features to canvas.
 *
 * This is the draw phase of the two-phase rendering:
 * 1. Layouts have already been computed in Phase 1 (layoutFeatures)
 * 2. Here we convert local coords to canvas coords and draw each feature
 * 3. Build Flatbush spatial indexes for hit detection
 */
export function makeImageData({
  ctx,
  layoutRecords,
  canvasWidth,
  renderArgs,
  configContext,
}: {
  ctx: CanvasRenderingContext2D
  layoutRecords: LayoutRecord[]
  canvasWidth: number
  renderArgs: RenderArgs
  configContext: RenderConfigContext
}) {
  const {
    bpPerPx,
    regions,
    theme: configTheme,
    stopToken,
    layout,
    peptideDataMap,
    colorByCDS,
    pluginManager,
  } = renderArgs

  const region = regions[0]!
  const theme = createJBrowseTheme(configTheme)

  // Create draw context once - shared across all features
  const drawContext: DrawContext = {
    region,
    bpPerPx,
    configContext,
    theme,
    canvasWidth,
    peptideDataMap,
    colorByCDS,
  }

  // Hit detection data
  const coords: number[] = []
  const items: FlatbushItem[] = []
  const subfeatureCoords: number[] = []
  const subfeatureInfos: SubfeatureInfo[] = []

  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  const { subfeatureLabels, transcriptTypes, config } = configContext
  const lastCheck = createStopTokenChecker(stopToken)

  for (const record of layoutRecords) {
    const {
      feature,
      layout: featureLayout,
      topPx: recordTopPx,
      label,
      description,
    } = record

    // Convert local coordinates to canvas coordinates
    const featureStartBp = feature.get(region.reversed ? 'end' : 'start')
    const startPx = bpToPx(featureStartBp, region, bpPerPx)
    const canvasLayout = convertToCanvasCoords(featureLayout, startPx, recordTopPx)

    // Draw the feature (all coordinates are now in canvas space)
    drawFeature(ctx, canvasLayout, drawContext, pluginManager)

    // Build hit detection indexes
    const bounds = {
      left: canvasLayout.x,
      right: canvasLayout.x + canvasLayout.totalLayoutWidth,
      top: canvasLayout.y,
      bottom: canvasLayout.y + canvasLayout.totalLayoutHeight,
    }

    const tooltip = String(
      readConfObject(config, 'mouseover', { feature, label, description }) ||
        '',
    )

    coords.push(bounds.left, bounds.top, bounds.right, bounds.bottom)
    items.push({
      featureId: feature.id(),
      type: 'box',
      startBp: feature.get('start'),
      endBp: feature.get('end'),
      leftPx: bounds.left,
      rightPx: bounds.right,
      topPx: bounds.top,
      bottomPx: bounds.bottom,
      tooltip,
    })

    // Build subfeature index for hit detection and floating labels
    buildChildrenIndex({
      layout,
      featureLayout: canvasLayout,
      subfeatureCoords,
      subfeatureInfos,
      config,
      configContext,
      pluginManager,
      subfeatureLabels,
      transcriptTypes,
      labelColor: theme.palette.text.primary,
      parentTooltip: tooltip,
    })

    checkStopToken2(lastCheck)
  }

  return {
    flatbush: buildFlatbush(coords, items.length).data,
    items,
    subfeatureFlatbush: buildFlatbush(subfeatureCoords, subfeatureInfos.length)
      .data,
    subfeatureInfos,
  }
}
