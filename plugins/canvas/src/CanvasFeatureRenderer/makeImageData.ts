import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { bpToPx, forEachWithStopTokenCheck } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'

import { drawFeature } from './drawFeature'

import type {
  FlatbushItem,
  LayoutRecord,
  RenderArgs,
  SubfeatureInfo,
} from './types'
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
  const canvasWidth = (region.end - region.start) / bpPerPx

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
  const transcriptTypes = readConfObject(config, 'transcriptTypes') as string[]

  // DEBUG: Log config values
  console.log('[DEBUG makeImageData] config:', {
    showSubfeatureLabels,
    transcriptTypes,
  })

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
      const childType = child.feature?.get('type')
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
    })

    // If it's a gene with transcript children, also add subfeature info to secondary flatbush
    if (isGene && hasTranscriptChildren) {
      addSubfeaturesToLayoutAndFlatbush(
        layout,
        adjustedLayout,
        feature.id(),
        region,
        bpPerPx,
        subfeatureCoords,
        subfeatureInfos,
        config,
        showSubfeatureLabels,
        transcriptTypes,
      )
    } else if (adjustedLayout.children.length > 0) {
      // Still need to add children to layout for data storage (not flatbush)
      addNestedSubfeaturesToLayout(
        layout,
        adjustedLayout,
        region,
        bpPerPx,
        config,
      )
    }
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
      totalFeatureHeight: child.totalFeatureHeight, // Keep total visual height with stacked children
      totalLayoutHeight: child.totalLayoutHeight, // Keep total height with labels
      totalLayoutWidth: child.totalLayoutWidth, // Keep total width with labels
      children: adjustChildPositions(child.children, xOffset, yOffset),
    }))
  }

  function addSubfeaturesToLayoutAndFlatbush(
    layout: any,
    featureLayout: any,
    parentFeatureId: string,
    region: any,
    bpPerPx: number,
    subfeatureCoords: number[],
    subfeatureInfos: SubfeatureInfo[],
    config: any,
    showSubfeatureLabels: boolean,
    transcriptTypes: string[],
  ) {
    // Add transcript children (e.g., mRNA, transcript) of a gene to secondary flatbush
    // This provides extra info (transcript ID) when hovering over transcripts
    // The parent gene's bounding box is already in the primary flatbush for highlighting
    for (const child of featureLayout.children) {
      const childFeature = child.feature
      if (!childFeature) {
        continue
      }

      const childType = childFeature.get('type')
      const isTranscript = transcriptTypes.includes(childType)

      // Only add transcript-type children to secondary flatbush
      if (!isTranscript) {
        // Non-transcript children just get stored in layout
        addNestedSubfeaturesToLayout(layout, child, region, bpPerPx, config)
        continue
      }

      const childStart = childFeature.get('start')
      const childEnd = childFeature.get('end')

      // Add the transcript's bounding box to secondary flatbush
      // This allows us to detect when hovering over a specific transcript and provide extra info
      // Use totalLayoutWidth and totalLayoutHeight to include label extent
      const childLeftPx = child.x
      const childRightPx = child.x + child.totalLayoutWidth
      const topPx = child.y
      const bottomPx = child.y + child.totalLayoutHeight // Use totalLayoutHeight to include labels
      subfeatureCoords.push(childLeftPx, topPx, childRightPx, bottomPx)

      // Get name for subfeature info (for tooltips/details)
      const transcriptName = String(
        readConfObject(config, ['labels', 'name'], { feature: childFeature }) ||
          '',
      )

      subfeatureInfos.push({
        subfeatureId: childFeature.id(),
        parentFeatureId,
        type: childType,
        name: transcriptName,
      })

      // Create floatingLabels for transcript when showSubfeatureLabels is enabled
      const floatingLabels: { text: string; relativeY: number; color: string }[] =
        []
      if (showSubfeatureLabels && transcriptName) {
        floatingLabels.push({
          text: transcriptName,
          relativeY: 0,
          color: 'black',
        })
      }

      // DEBUG: Log subfeature label creation
      console.log('[DEBUG makeImageData] transcript:', {
        id: childFeature.id(),
        transcriptName,
        showSubfeatureLabels,
        floatingLabelsLength: floatingLabels.length,
        childHeight: child.height,
        childTotalLayoutWidth: child.totalLayoutWidth,
      })

      // Store child feature using addRect so CoreGetFeatureDetails can access it
      // When showSubfeatureLabels is enabled, pass floatingLabels for rendering
      // Note: We store the actual visual Y position (topPx) in serializableData because
      // the layout's collision detection places rects at different positions than
      // where they're visually rendered within the parent gene glyph
      layout.addRect(
        childFeature.id(),
        childStart,
        childEnd,
        bottomPx - topPx,
        childFeature,
        {
          refName: childFeature.get('refName'),
          ...(showSubfeatureLabels && floatingLabels.length > 0
            ? {
                floatingLabels,
                totalFeatureHeight: child.height,
                totalLayoutWidth: child.totalLayoutWidth,
                // Store actual visual Y position for correct label placement
                actualTopPx: topPx,
              }
            : {}),
        },
      )

      // Debug: Draw blue bounding box for transcript subfeatures only
      // (includes totalLayoutWidth and totalLayoutHeight with label extent)
      // ctx.save()
      // ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)' // Blue for transcripts
      // ctx.lineWidth = 1
      // ctx.setLineDash([2, 2])
      // ctx.strokeRect(childLeftPx, topPx, childRightPx - childLeftPx, child.totalLayoutHeight)
      // ctx.restore()

      // Store layout/feature data for nested children (CDS, UTR, exons) but don't add them to flatbush
      // This allows clicking on them to get details, but mouseover targets the parent transcript
      if (child.children.length > 0) {
        addNestedSubfeaturesToLayout(layout, child, region, bpPerPx, config)
      }
    }
  }

  function addNestedSubfeaturesToLayout(
    layout: any,
    featureLayout: any,
    region: any,
    bpPerPx: number,
    config: any,
  ) {
    // Recursively add deeply nested children (CDS, UTR, exons) to layout only
    // They won't be separate mouseover targets, but their data is available
    for (const child of featureLayout.children) {
      const childFeature = child.feature
      if (childFeature) {
        const childStart = childFeature.get('start')
        const childEnd = childFeature.get('end')

        // Store nested child feature using addRect so CoreGetFeatureDetails can access it
        // Don't pass label/description to prevent FloatingLabels from rendering subfeature labels
        layout.addRect(
          childFeature.id(),
          childStart,
          childEnd,
          child.height,
          childFeature,
          {
            refName: childFeature.get('refName'),
          },
        )

        if (child.children.length > 0) {
          addNestedSubfeaturesToLayout(layout, child, region, bpPerPx, config)
        }
      }
    }
  }

  // Create primary spatial index (for highlighting)
  const flatbush = new Flatbush(Math.max(items.length, 1))
  if (coords.length) {
    for (let i = 0; i < coords.length; i += 4) {
      flatbush.add(coords[i]!, coords[i + 1]!, coords[i + 2], coords[i + 3])
    }
  } else {
    flatbush.add(0, 0, 0, 0)
  }
  flatbush.finish()

  // Create secondary spatial index (for subfeature info)
  const subfeatureFlatbush = new Flatbush(Math.max(subfeatureInfos.length, 1))
  if (subfeatureCoords.length) {
    for (let i = 0; i < subfeatureCoords.length; i += 4) {
      subfeatureFlatbush.add(
        subfeatureCoords[i]!,
        subfeatureCoords[i + 1]!,
        subfeatureCoords[i + 2],
        subfeatureCoords[i + 3],
      )
    }
  } else {
    subfeatureFlatbush.add(0, 0, 0, 0)
  }
  subfeatureFlatbush.finish()

  return {
    flatbush: flatbush.data,
    items,
    subfeatureFlatbush: subfeatureFlatbush.data,
    subfeatureInfos,
  }
}
