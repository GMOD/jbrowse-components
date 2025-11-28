import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { bpToPx, forEachWithStopTokenCheck } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'

import { drawFeature } from './drawFeature'
import {
  addNestedSubfeaturesToLayout,
  addSubfeaturesToLayoutAndFlatbush,
  adjustChildPositions,
} from './layoutUtils'

import type {
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
export function makeImageData({
  ctx,
  layoutRecords,
  canvasWidth,
  renderArgs,
}: {
  ctx: CanvasRenderingContext2D
  layoutRecords: LayoutRecord[]
  canvasWidth: number
  renderArgs: RenderArgs
}) {
  const {
    config,
    bpPerPx,
    regions,
    theme: configTheme,
    stopToken,
    layout,
    peptideDataMap,
    colorByCDS,
  } = renderArgs
  const region = regions[0]!
  const theme = createJBrowseTheme(configTheme)

  const coords: number[] = []
  const items: FlatbushItem[] = []

  // Secondary flatbush for subfeature info
  const subfeatureCoords: number[] = []
  const subfeatureInfos: SubfeatureInfo[] = []

  // Set default canvas styles
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'

  // Pre-read color config values to optimize getBoxColor performance
  // Check if colors are callbacks to avoid unnecessary readConfObject calls
  const isColor1Callback = config.color1?.isCallback ?? false
  const isColor3Callback = config.color3?.isCallback ?? false
  const color1 = isColor1Callback ? undefined : readConfObject(config, 'color1')
  const color3 = isColor3Callback ? undefined : readConfObject(config, 'color3')

  // Read showSubfeatureLabels for transcript label rendering
  const showSubfeatureLabels = readConfObject(
    config,
    'showSubfeatureLabels',
  ) as boolean
  const subfeatureLabelPosition = readConfObject(
    config,
    'subfeatureLabelPosition',
  ) as string
  const transcriptTypes = readConfObject(config, 'transcriptTypes') as string[]

  forEachWithStopTokenCheck(layoutRecords, stopToken, record => {
    const { feature, layout: featureLayout, topPx: recordTopPx } = record

    // Adjust layout position to absolute coordinates
    const start = feature.get(region.reversed ? 'end' : 'start')
    const startPx = bpToPx(start, region, bpPerPx)

    // Create adjusted layout with absolute positions
    const adjustedLayout = {
      ...featureLayout,
      x: startPx + featureLayout.x,
      y: recordTopPx + featureLayout.y,
      height: featureLayout.height, // Visual height (what gets drawn)
      totalFeatureHeight: featureLayout.totalFeatureHeight, // Total visual height with stacked children
      totalLayoutHeight: featureLayout.totalLayoutHeight, // Total with label space
      totalLayoutWidth: featureLayout.totalLayoutWidth, // Total with label width
      children: adjustChildPositions(
        featureLayout.children,
        startPx,
        recordTopPx,
      ),
    }

    drawFeature({
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
      peptideDataMap,
      colorByCDS,
      color1,
      color3,
      isColor1Callback,
      isColor3Callback,
    })

    // Determine if this feature is a gene with transcript children
    const featureType = feature.get('type')
    const isGene = featureType === 'gene'
    const hasTranscriptChildren = adjustedLayout.children.some(child => {
      const childType = child.feature.get('type')
      return transcriptTypes.includes(childType)
    })

    // Always add the feature's bounding box to the primary flatbush
    // Use totalLayoutWidth and totalLayoutHeight to include label extent
    const featureStartBp = feature.get('start')
    const featureEndBp = feature.get('end')
    const leftPx = adjustedLayout.x
    const rightPx = adjustedLayout.x + adjustedLayout.totalLayoutWidth
    const topPx = adjustedLayout.y
    const bottomPx = adjustedLayout.y + adjustedLayout.totalLayoutHeight // Use totalLayoutHeight to include labels

    const label = String(
      readConfObject(config, ['labels', 'name'], { feature }) || '',
    )
    const description = String(
      readConfObject(config, ['labels', 'description'], { feature }) || '',
    )
    const mouseOver = feature.get('_mouseOver') as string | undefined

    coords.push(leftPx, topPx, rightPx, bottomPx)
    items.push({
      featureId: feature.id(),
      type: 'box',
      startBp: featureStartBp,
      endBp: featureEndBp,
      leftPx,
      rightPx,
      topPx,
      bottomPx,
      label: label || undefined,
      description: description || undefined,
      mouseOver,
    })

    // If it's a gene with transcript children, also add subfeature info to secondary flatbush
    if (isGene && hasTranscriptChildren) {
      addSubfeaturesToLayoutAndFlatbush({
        layout,
        featureLayout: adjustedLayout,
        parentFeatureId: feature.id(),
        subfeatureCoords,
        subfeatureInfos,
        config,
        showSubfeatureLabels,
        subfeatureLabelPosition,
        transcriptTypes,
        labelColor: theme.palette.text.primary,
      })
    } else if (adjustedLayout.children.length > 0) {
      // Still need to add children to layout for data storage (not flatbush)
      addNestedSubfeaturesToLayout({
        layout,
        featureLayout: adjustedLayout,
      })
    }
  })

  return {
    flatbush: buildFlatbush(coords, items.length).data,
    items,
    subfeatureFlatbush: buildFlatbush(subfeatureCoords, subfeatureInfos.length)
      .data,
    subfeatureInfos,
  }
}
