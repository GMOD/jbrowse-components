import { createJBrowseTheme } from '@jbrowse/core/ui'
import { bpToPx, forEachWithStopTokenCheck } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'

import { drawFeature } from './drawFeature'
import { getLayoutWidth, layoutFeature } from './simpleLayout'

import type { FlatbushItem, LayoutRecord, RenderArgs, SubfeatureInfo } from './types'
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
  const { config, bpPerPx, regions, theme: configTheme, stopToken, layout } = renderArgs
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
      totalHeight: featureLayout.totalHeight, // Total with label space
      totalWidth: featureLayout.totalWidth, // Total with label width
      children: adjustChildPositions(featureLayout.children, startPx, recordTopPx),
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

    // Determine if this feature is a gene with transcript children
    const featureType = feature.get('type')
    const isGene = featureType === 'gene'
    const hasTranscriptChildren = adjustedLayout.children.length > 0 &&
      adjustedLayout.children.some(child => {
        const childType = child.feature?.get('type')
        return childType === 'mRNA' || childType === 'transcript' ||
               childType === 'protein_coding_primary_transcript'
      })

    // Always add the feature's bounding box to the primary flatbush
    // Use the actual feature bounds (not totalWidth/totalHeight which includes labels)
    const featureStartBp = feature.get('start')
    const featureEndBp = feature.get('end')
    const [leftPx, rightPx] = [
      bpToPx(featureStartBp, region, bpPerPx),
      bpToPx(featureEndBp, region, bpPerPx),
    ]
    const topPx = adjustedLayout.y
    const bottomPx = adjustedLayout.y + adjustedLayout.height // Use height, not totalHeight
    coords.push(leftPx, topPx, rightPx, bottomPx)
    items.push({
      featureId: feature.id(),
      type: 'box',
      startBp: featureStartBp,
      endBp: featureEndBp,
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
      )
    } else if (adjustedLayout.children.length > 0) {
      // Still need to add children to layout for data storage (not flatbush)
      addNestedSubfeaturesToLayout(layout, adjustedLayout, region, bpPerPx)
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
      totalHeight: child.totalHeight, // Keep total height with labels
      totalWidth: child.totalWidth, // Keep total width with labels
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
  ) {
    // Add transcript children (e.g., mRNA, transcript) of a gene to secondary flatbush
    // This provides extra info (transcript ID) when hovering over transcripts
    // The parent gene's bounding box is already in the primary flatbush for highlighting
    for (const child of featureLayout.children) {
      const childFeature = child.feature
      if (!childFeature) continue

      const childType = childFeature.get('type')
      const isTranscript = childType === 'mRNA' || childType === 'transcript' ||
                          childType === 'protein_coding_primary_transcript'

      // Only add transcript-type children to secondary flatbush
      if (!isTranscript) {
        // Non-transcript children just get stored in layout
        addNestedSubfeaturesToLayout(layout, child, region, bpPerPx)
        continue
      }

      const childStart = childFeature.get('start')
      const childEnd = childFeature.get('end')

      // Add the transcript's bounding box to secondary flatbush
      // This allows us to detect when hovering over a specific transcript and provide extra info
      // Use actual feature bounds (not totalWidth/totalHeight which includes labels)
      const [childLeftPx, childRightPx] = [
        bpToPx(childStart, region, bpPerPx),
        bpToPx(childEnd, region, bpPerPx),
      ]
      const topPx = child.y
      const bottomPx = child.y + child.height // Use height, not totalHeight
      subfeatureCoords.push(childLeftPx, topPx, childRightPx, bottomPx)

      // Compute user-friendly name for the transcript
      const transcriptName = childFeature.get('name') || childFeature.get('id')

      subfeatureInfos.push({
        subfeatureId: childFeature.id(),
        parentFeatureId,
        type: childType,
        name: transcriptName,
      })

      // Store the rectangle data for the transcript for selection/clicking
      // Note: This is stored but not used for primary mouseover highlighting
      layout.rectangles.set(childFeature.id(), [
        childStart,
        topPx,
        childEnd,
        bottomPx,
        {
          label: childFeature.get('name') || childFeature.get('id'),
          description: childFeature.get('description') || childFeature.get('note'),
          refName: childFeature.get('refName'),
        },
      ])

      console.log('Stored transcript in layout.rectangles:', childFeature.id(), [childStart, topPx, childEnd, bottomPx])

      // Store the feature data for CoreGetFeatureDetails
      if (layout.rectangleData) {
        layout.rectangleData.set(childFeature.id(), childFeature)
      }

      // Debug: Draw blue bounding box for transcript subfeatures only
      ctx.save()
      ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)' // Blue for transcripts
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])
      ctx.strokeRect(childLeftPx, topPx, childRightPx - childLeftPx, bottomPx - topPx)
      ctx.restore()

      console.log('Added TRANSCRIPT to secondary flatbush:', childFeature.id(), 'type:', childType, 'parent:', parentFeatureId, 'bbox:', childLeftPx, topPx, childRightPx, bottomPx)

      // Store layout/feature data for nested children (CDS, UTR, exons) but don't add them to flatbush
      // This allows clicking on them to get details, but mouseover targets the parent transcript
      if (child.children.length > 0) {
        addNestedSubfeaturesToLayout(layout, child, region, bpPerPx)
      }
    }
  }

  function addNestedSubfeaturesToLayout(
    layout: any,
    featureLayout: any,
    region: any,
    bpPerPx: number,
  ) {
    // Recursively add deeply nested children (CDS, UTR, exons) to layout only
    // They won't be separate mouseover targets, but their data is available
    for (const child of featureLayout.children) {
      const childFeature = child.feature
      if (childFeature) {
        const childStart = childFeature.get('start')
        const childEnd = childFeature.get('end')

        layout.rectangles.set(childFeature.id(), [
          childStart,
          child.y,
          childEnd,
          child.y + child.height,
          {
            label: childFeature.get('name') || childFeature.get('id'),
            description: childFeature.get('description') || childFeature.get('note'),
            refName: childFeature.get('refName'),
          },
        ])

        if (layout.rectangleData) {
          layout.rectangleData.set(childFeature.id(), childFeature)
        }

        if (child.children.length > 0) {
          addNestedSubfeaturesToLayout(layout, child, region, bpPerPx)
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
        subfeatureCoords[i + 2]!,
        subfeatureCoords[i + 3]!,
      )
    }
  } else {
    subfeatureFlatbush.add(0, 0, 0, 0)
  }
  subfeatureFlatbush.finish()

  console.log('Primary flatbush created with', items.length, 'items')
  console.log('Secondary flatbush created with', subfeatureInfos.length, 'subfeatures')

  return {
    flatbush: flatbush.data,
    items,
    subfeatureFlatbush: subfeatureFlatbush.data,
    subfeatureInfos,
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
