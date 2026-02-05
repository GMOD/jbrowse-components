/**
 * WebGL Feature Data RPC Executor
 *
 * COORDINATE SYSTEM REQUIREMENT:
 * All position data in this module uses integer coordinates. View region bounds
 * (region.start, region.end) can be fractional from scrolling/zooming, so we
 * convert to integers: regionStart = floor(region.start). All positions are then
 * stored as integer offsets from regionStart. This ensures consistent alignment
 * between feature rectangles, lines, and hit detection.
 */

import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { dedupe, measureText, updateStatus } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { createFeatureFloatingLabels } from '../CanvasFeatureRenderer/floatingLabels.ts'
import { layoutFeature } from '../CanvasFeatureRenderer/layout/layoutFeature.ts'
import {
  getBoxColor,
  getStrokeColor,
  isUTR,
} from '../CanvasFeatureRenderer/util.ts'

import type {
  FeatureLabelData,
  FlatbushItem,
  FloatingLabelsDataMap,
  RenderWebGLFeatureDataArgs,
  SubfeatureInfo,
  WebGLFeatureDataResult,
} from './types.ts'
import type { RenderConfigContext } from '../CanvasFeatureRenderer/renderConfig.ts'
import type { LayoutRecord } from '../CanvasFeatureRenderer/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'

interface RectData {
  startOffset: number
  endOffset: number
  y: number
  height: number
  color: number
  type: number
}

interface LineData {
  startOffset: number
  endOffset: number
  y: number
  color: number
  direction: number // strand direction: -1, 0, or 1
}

interface ArrowData {
  x: number
  y: number
  direction: number
  height: number
  color: number
}

const UTR_HEIGHT_FRACTION = 0.65

function colorToUint32(colorStr: string): number {
  // Parse CSS color to RGBA packed as uint32
  // For simplicity, handle common formats
  if (colorStr.startsWith('#')) {
    const hex = colorStr.slice(1)
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      return (255 << 24) | (b << 16) | (g << 8) | r // ABGR for WebGL
    }
    if (hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      const a = parseInt(hex.slice(6, 8), 16)
      return (a << 24) | (b << 16) | (g << 8) | r
    }
  }
  if (colorStr.startsWith('rgb')) {
    const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(
      colorStr,
    )
    if (match) {
      const r = parseInt(match[1]!, 10)
      const g = parseInt(match[2]!, 10)
      const b = parseInt(match[3]!, 10)
      const a = match[4] ? Math.round(parseFloat(match[4]) * 255) : 255
      return (a << 24) | (b << 16) | (g << 8) | r
    }
  }
  // Named colors - just use a default
  const namedColors: Record<string, number> = {
    goldenrod: 0xff20a5da,
    black: 0xff000000,
    white: 0xffffffff,
    red: 0xff0000ff,
    green: 0xff00ff00,
    blue: 0xffff0000,
  }
  return namedColors[colorStr.toLowerCase()] ?? 0xff808080
}

interface LayoutRecordWithLabels extends LayoutRecord {
  totalHeightWithLabels?: number
}

function collectRenderData(
  layoutRecords: LayoutRecordWithLabels[],
  regionStart: number,
  bpPerPx: number,
  config: unknown,
  configContext: RenderConfigContext,
  theme: unknown,
  reversed: boolean,
): {
  rects: RectData[]
  lines: LineData[]
  arrows: ArrowData[]
  floatingLabelsData: FloatingLabelsDataMap
  flatbushItems: FlatbushItem[]
  subfeatureInfos: SubfeatureInfo[]
  maxY: number
} {
  const rects: RectData[] = []
  const lines: LineData[] = []
  const arrows: ArrowData[] = []
  const floatingLabelsData: FloatingLabelsDataMap = {}
  const flatbushItems: FlatbushItem[] = []
  const subfeatureInfos: SubfeatureInfo[] = []
  let maxY = 0

  for (const record of layoutRecords) {
    const { feature, layout, topPx, totalHeightWithLabels } = record
    const featureStart = feature.get('start')
    const featureEnd = feature.get('end')
    const strand = (feature.get('strand') as number) || 0

    const featureY = topPx + layout.height / 2
    if (featureY > maxY) {
      maxY = featureY
    }

    const fillColor = getBoxColor({
      feature,
      config: config as any,
      configContext,
      colorByCDS: false,
      theme: theme as any,
    })
    const strokeColor = getStrokeColor({
      feature,
      config: config as any,
      configContext,
      theme: theme as any,
    })
    const colorUint = colorToUint32(fillColor)
    const strokeUint = colorToUint32(strokeColor)

    // Collect floating labels
    // Match the JEXL expressions from config schema for name and description
    const name = String(feature.get('name') || feature.get('id') || '')
    const description = String(
      feature.get('note') || feature.get('description') || '',
    )
    const floatingLabels = createFeatureFloatingLabels({
      feature,
      config: config as any,
      configContext,
      nameColor: 'black',
      descriptionColor: 'blue',
      name,
      description,
    })

    if (floatingLabels.length > 0) {
      const labelData: FeatureLabelData = {
        featureId: feature.id(),
        minX: featureStart - regionStart,
        maxX: featureEnd - regionStart,
        topY: topPx,
        featureHeight: layout.height,
        floatingLabels,
      }
      floatingLabelsData[feature.id()] = labelData
    }

    // Build tooltip
    const featureType = feature.get('type') || 'feature'
    const tooltip = name
      ? `${name}${description ? ` - ${description}` : ''}`
      : `${featureType}: ${featureStart.toLocaleString()}-${featureEnd.toLocaleString()}`

    // Add to flatbush items for hit detection
    // Use totalHeightWithLabels to include label area in hit box
    const hitBoxHeight = totalHeightWithLabels ?? layout.totalLayoutHeight
    flatbushItems.push({
      featureId: feature.id(),
      type: featureType,
      startBp: featureStart,
      endBp: featureEnd,
      topPx,
      bottomPx: topPx + hitBoxHeight,
      tooltip,
      name: name || undefined,
      strand: strand || undefined,
    })

    // Helper to process a transcript-like layout (ProcessedTranscript or Segments)
    const processTranscriptLayout = (
      transcriptLayout: typeof layout,
      transcriptTopPx: number,
      parentFeature: typeof feature,
    ) => {
      const transcriptFeature = transcriptLayout.feature
      const transcriptStart = transcriptFeature.get('start')
      const transcriptEnd = transcriptFeature.get('end')
      const transcriptStrand = (transcriptFeature.get('strand') as number) || 0

      // Get parent/transcript names for tooltips
      const parentName = String(
        parentFeature.get('name') || parentFeature.get('id') || '',
      )
      const transcriptName = String(
        transcriptFeature.get('name') || transcriptFeature.get('id') || '',
      )
      const isNestedTranscript = transcriptFeature.id() !== parentFeature.id()

      const transcriptStrokeColor = getStrokeColor({
        feature: transcriptFeature,
        config: config as any,
        configContext,
        theme: theme as any,
      })
      const transcriptStrokeUint = colorToUint32(transcriptStrokeColor)

      // Draw connecting line for the transcript span
      const effectiveStrand = reversed ? -transcriptStrand : transcriptStrand
      lines.push({
        startOffset: transcriptStart - regionStart,
        endOffset: transcriptEnd - regionStart,
        y: transcriptTopPx + transcriptLayout.height / 2,
        color: transcriptStrokeUint,
        direction: effectiveStrand,
      })

      // Draw children (exons, CDS, UTRs)
      for (const childLayout of transcriptLayout.children) {
        const childFeature = childLayout.feature
        const childStart = childFeature.get('start')
        const childEnd = childFeature.get('end')
        const childIsUTR = isUTR(childFeature)
        const childType = childFeature.get('type') || 'exon'

        const childColor = getBoxColor({
          feature: childFeature,
          config: config as any,
          configContext,
          colorByCDS: false,
          theme: theme as any,
        })
        const childColorUint = colorToUint32(childColor)

        let childTopPx = transcriptTopPx
        let childHeight = childLayout.height
        if (childIsUTR) {
          childTopPx +=
            ((1 - UTR_HEIGHT_FRACTION) / 2) * transcriptLayout.height
          childHeight = transcriptLayout.height * UTR_HEIGHT_FRACTION
        }

        rects.push({
          startOffset: childStart - regionStart,
          endOffset: childEnd - regionStart,
          y: childTopPx,
          height: childHeight,
          color: childColorUint,
          type: childIsUTR ? 1 : 0,
        })

        // Note: We don't add exon/CDS/UTR to subfeatureInfos for hit detection
        // Only transcript and gene level features are clickable
      }

      // Add transcript-level hit detection entry (spans entire transcript area)
      // Added after children so exon/CDS hits take priority
      const transcriptTooltipParts: string[] = []
      if (parentName) {
        transcriptTooltipParts.push(`Gene: ${parentName}`)
      }
      if (transcriptName) {
        transcriptTooltipParts.push(`Transcript: ${transcriptName}`)
      }
      transcriptTooltipParts.push(
        `${transcriptFeature.get('type') || 'transcript'}: ${transcriptStart.toLocaleString()}-${transcriptEnd.toLocaleString()}`,
      )

      subfeatureInfos.push({
        featureId: transcriptFeature.id(),
        parentFeatureId: parentFeature.id(),
        type: transcriptFeature.get('type') || 'transcript',
        startBp: transcriptStart,
        endBp: transcriptEnd,
        topPx: transcriptTopPx,
        bottomPx: transcriptTopPx + transcriptLayout.height,
        displayLabel: transcriptName || 'transcript',
        tooltip: transcriptTooltipParts.join('\n'),
      })

      // Add strand arrow for transcript
      if (transcriptStrand !== 0) {
        const effectiveStrand = reversed ? -transcriptStrand : transcriptStrand
        const arrowX = effectiveStrand === 1 ? transcriptEnd : transcriptStart
        arrows.push({
          x: arrowX - regionStart,
          y: transcriptTopPx + transcriptLayout.height / 2,
          direction: effectiveStrand,
          height: transcriptLayout.height,
          color: transcriptStrokeUint,
        })
      }
    }

    // Process layout based on glyph type
    if (
      layout.glyphType === 'ProcessedTranscript' ||
      layout.glyphType === 'Segments'
    ) {
      processTranscriptLayout(layout, topPx, feature)
    } else if (layout.glyphType === 'Subfeatures') {
      // Gene-like feature with nested transcript children
      // Process each child transcript
      for (const childLayout of layout.children) {
        if (
          childLayout.glyphType === 'ProcessedTranscript' ||
          childLayout.glyphType === 'Segments'
        ) {
          // Child is a transcript - process it with its relative position
          const childTopPx = topPx + childLayout.y
          processTranscriptLayout(childLayout, childTopPx, feature)
        } else {
          // Child is a simple feature - draw as box
          const childFeature = childLayout.feature
          const childStart = childFeature.get('start')
          const childEnd = childFeature.get('end')
          const childIsUTR = isUTR(childFeature)
          const childType = childFeature.get('type') || 'feature'

          const childColor = getBoxColor({
            feature: childFeature,
            config: config as any,
            configContext,
            colorByCDS: false,
            theme: theme as any,
          })
          const childColorUint = colorToUint32(childColor)

          let childTopPx = topPx + childLayout.y
          let childHeight = childLayout.height
          if (childIsUTR) {
            childTopPx += ((1 - UTR_HEIGHT_FRACTION) / 2) * childLayout.height
            childHeight = childLayout.height * UTR_HEIGHT_FRACTION
          }

          rects.push({
            startOffset: childStart - regionStart,
            endOffset: childEnd - regionStart,
            y: childTopPx,
            height: childHeight,
            color: childColorUint,
            type: childIsUTR ? 1 : 0,
          })

          // Note: We don't add simple child features to subfeatureInfos
          // Only transcript and gene level features are clickable
        }
      }
    } else {
      // Simple box feature
      const rectIsUTR = isUTR(feature)
      let rectTopPx = topPx
      let rectHeight = layout.height
      if (rectIsUTR) {
        rectTopPx += ((1 - UTR_HEIGHT_FRACTION) / 2) * layout.height
        rectHeight = layout.height * UTR_HEIGHT_FRACTION
      }

      rects.push({
        startOffset: featureStart - regionStart,
        endOffset: featureEnd - regionStart,
        y: rectTopPx,
        height: rectHeight,
        color: colorUint,
        type: rectIsUTR ? 1 : 0,
      })

      // Add strand arrow for top-level features
      const isTopLevel = !feature.parent?.()
      if (isTopLevel && strand !== 0) {
        const effectiveStrand = reversed ? -strand : strand
        const arrowX = effectiveStrand === 1 ? featureEnd : featureStart
        arrows.push({
          x: arrowX - regionStart,
          y: topPx + layout.height / 2,
          direction: effectiveStrand,
          height: layout.height,
          color: strokeUint,
        })
      }
    }
  }

  return {
    rects,
    lines,
    arrows,
    floatingLabelsData,
    flatbushItems,
    subfeatureInfos,
    maxY,
  }
}

export async function executeRenderWebGLFeatureData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RenderWebGLFeatureDataArgs
}): Promise<WebGLFeatureDataResult> {
  console.log('executeRenderWebGLFeatureData: Starting', args.region)
  const {
    sessionId,
    adapterConfig,
    rendererConfig,
    region,
    bpPerPx: requestedBpPerPx,
    statusCallback = () => {},
    stopToken,
  } = args as RenderWebGLFeatureDataArgs & {
    statusCallback?: (msg: string) => void
    stopToken?: string
  }

  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  const regionWithAssembly = {
    ...region,
    assemblyName: region.assemblyName ?? '',
  }

  const featuresArray = await updateStatus(
    'Fetching features',
    statusCallback,
    () =>
      firstValueFrom(
        dataAdapter.getFeatures(regionWithAssembly).pipe(toArray()),
      ),
  )

  checkStopToken2(stopTokenCheck)

  // Genomic positions are integers, but region bounds from the view can be fractional.
  // Use floor to get integer reference point for storing position offsets.
  const regionStart = Math.floor(region.start)
  const bpPerPx = requestedBpPerPx || 1 // Use actual zoom level for layout

  // Create a mock theme for color calculations
  const mockTheme = {
    palette: {
      text: { secondary: '#666666' },
      framesCDS: [],
    },
  }

  // Create a mock config object with all default values that readConfObject can read
  // This is needed because the serialized config loses its MST model methods
  const mockConfig = {
    color1: 'goldenrod',
    color2: '#f0f',
    color3: '#357089',
    outline: '',
    height: 10,
    showLabels: true,
    showDescriptions: true,
    subfeatureLabels: 'none',
    displayMode: 'normal',
    maxFeatureGlyphExpansion: 500,
    maxHeight: 5000,
    subParts: 'CDS,UTR,five_prime_UTR,three_prime_UTR',
    impliedUTRs: false,
    transcriptTypes: ['mRNA', 'transcript', 'primary_transcript'],
    containerTypes: ['proteoform_orf'],
    geneGlyphMode: 'all',
    displayDirectionalChevrons: true,
    labels: {
      name: '',
      nameColor: '#f0f',
      description: '',
      descriptionColor: 'blue',
      fontSize: 12,
    },
    // Merge any values from the passed config
    ...rendererConfig,
  }

  // Create default config context for WebGL rendering
  const configContext: RenderConfigContext = {
    config: mockConfig as any,
    displayMode: mockConfig.displayMode,
    showLabels: mockConfig.showLabels,
    showDescriptions: mockConfig.showDescriptions,
    subfeatureLabels: mockConfig.subfeatureLabels,
    transcriptTypes: mockConfig.transcriptTypes,
    containerTypes: mockConfig.containerTypes,
    geneGlyphMode: mockConfig.geneGlyphMode,
    displayDirectionalChevrons: mockConfig.displayDirectionalChevrons,
    color1: { value: mockConfig.color1, isCallback: false },
    color2: { value: mockConfig.color2, isCallback: false },
    color3: { value: mockConfig.color3, isCallback: false },
    outline: { value: mockConfig.outline, isCallback: false },
    featureHeight: { value: mockConfig.height, isCallback: false },
    fontHeight: { value: mockConfig.labels.fontSize, isCallback: false },
    nameColor: { value: mockConfig.labels.nameColor, isCallback: false },
    descriptionColor: {
      value: mockConfig.labels.descriptionColor,
      isCallback: false,
    },
    labelAllowed: mockConfig.displayMode !== 'collapse',
    heightMultiplier: mockConfig.displayMode === 'compact' ? 0.5 : 1,
  }

  const { layoutRecords, maxY } = await updateStatus(
    'Computing layout',
    statusCallback,
    async () => {
      const deduped = dedupe(featuresArray, (f: Feature) => f.id())
      const features = new Map(deduped.map(f => [f.id(), f]))

      const layout = new GranularRectLayout()
      const reversed = region.reversed ?? false
      const yPadding = 5

      const records: LayoutRecord[] = []

      for (const feature of features.values()) {
        const featureLayout = layoutFeature({
          feature,
          bpPerPx,
          reversed,
          configContext,
          pluginManager,
        })

        const featureStart = feature.get('start')
        const featureEnd = feature.get('end')
        const leftPaddingBp = featureLayout.leftPadding * bpPerPx
        const rightPaddingBp =
          (featureLayout.totalLayoutWidth -
            featureLayout.width -
            featureLayout.leftPadding) *
          bpPerPx

        let layoutStart: number
        let layoutEnd: number
        if (reversed) {
          layoutStart = featureStart - rightPaddingBp
          layoutEnd = featureEnd + leftPaddingBp
        } else {
          layoutStart = featureStart - leftPaddingBp
          layoutEnd = featureEnd + rightPaddingBp
        }

        // Manually add space for labels since the config callback system isn't available
        // Match the JEXL expressions from config schema
        const featureName = String(
          feature.get('name') || feature.get('id') || '',
        )
        const featureDescription = String(
          feature.get('note') || feature.get('description') || '',
        )
        const fontSize = mockConfig.labels.fontSize
        let labelHeight = 0
        let maxLabelWidth = 0
        if (featureName && mockConfig.showLabels) {
          labelHeight += fontSize
          maxLabelWidth = Math.max(maxLabelWidth, measureText(featureName, 11))
        }
        if (featureDescription && mockConfig.showDescriptions) {
          labelHeight += fontSize
          maxLabelWidth = Math.max(
            maxLabelWidth,
            measureText(featureDescription, 11),
          )
        }

        // Extend layout bounds to account for label width
        // Labels are positioned at the feature's left edge and extend rightward
        const featureWidthPx = (featureEnd - featureStart) / bpPerPx
        if (maxLabelWidth > featureWidthPx) {
          const extraLabelWidthBp = (maxLabelWidth - featureWidthPx) * bpPerPx
          if (reversed) {
            layoutStart -= extraLabelWidthBp
          } else {
            layoutEnd += extraLabelWidthBp
          }
        }

        const layoutHeight = featureLayout.height + labelHeight + yPadding
        const topPx = layout.addRect(
          feature.id(),
          layoutStart,
          layoutEnd,
          layoutHeight,
          feature,
        )

        if (topPx !== null) {
          records.push({
            feature,
            layout: featureLayout,
            topPx,
            // Include the full height with labels for hit detection
            totalHeightWithLabels: layoutHeight,
          })
        }
      }

      return {
        layoutRecords: records,
        maxY: layout.getTotalHeight(),
      }
    },
  )

  checkStopToken2(stopTokenCheck)

  const {
    rects,
    lines,
    arrows,
    floatingLabelsData,
    flatbushItems,
    subfeatureInfos,
  } = await updateStatus('Collecting render data', statusCallback, async () =>
    collectRenderData(
      layoutRecords,
      regionStart,
      bpPerPx,
      mockConfig,
      configContext,
      mockTheme,
      region.reversed ?? false,
    ),
  )

  // Build Flatbush spatial indexes for hit detection
  let flatbushData = new ArrayBuffer(0)
  let subfeatureFlatbushData = new ArrayBuffer(0)

  if (flatbushItems.length > 0) {
    const featureIndex = new Flatbush(flatbushItems.length)
    for (const item of flatbushItems) {
      featureIndex.add(item.startBp, item.topPx, item.endBp, item.bottomPx)
    }
    featureIndex.finish()
    flatbushData = featureIndex.data
  }

  if (subfeatureInfos.length > 0) {
    const subfeatureIndex = new Flatbush(subfeatureInfos.length)
    for (const item of subfeatureInfos) {
      subfeatureIndex.add(item.startBp, item.topPx, item.endBp, item.bottomPx)
    }
    subfeatureIndex.finish()
    subfeatureFlatbushData = subfeatureIndex.data
  }

  // Convert to TypedArrays
  const rectPositions = new Uint32Array(rects.length * 2)
  const rectYs = new Float32Array(rects.length)
  const rectHeights = new Float32Array(rects.length)
  const rectColors = new Uint32Array(rects.length)
  const rectTypes = new Uint8Array(rects.length)

  for (const [i, rect] of rects.entries()) {
    rectPositions[i * 2] = Math.max(0, rect.startOffset)
    rectPositions[i * 2 + 1] = rect.endOffset
    rectYs[i] = rect.y
    rectHeights[i] = rect.height
    rectColors[i] = rect.color
    rectTypes[i] = rect.type
  }

  const linePositions = new Uint32Array(lines.length * 2)
  const lineYs = new Float32Array(lines.length)
  const lineColors = new Uint32Array(lines.length)
  const lineDirections = new Int8Array(lines.length)

  for (const [i, line] of lines.entries()) {
    linePositions[i * 2] = Math.max(0, line.startOffset)
    linePositions[i * 2 + 1] = line.endOffset
    lineYs[i] = line.y
    lineColors[i] = line.color
    lineDirections[i] = line.direction
  }

  const arrowXs = new Uint32Array(arrows.length)
  const arrowYs = new Float32Array(arrows.length)
  const arrowDirections = new Int8Array(arrows.length)
  const arrowHeights = new Float32Array(arrows.length)
  const arrowColors = new Uint32Array(arrows.length)

  for (const [i, arrow] of arrows.entries()) {
    arrowXs[i] = Math.max(0, arrow.x)
    arrowYs[i] = arrow.y
    arrowDirections[i] = arrow.direction
    arrowHeights[i] = arrow.height
    arrowColors[i] = arrow.color
  }

  const result: WebGLFeatureDataResult = {
    regionStart,

    rectPositions,
    rectYs,
    rectHeights,
    rectColors,
    rectTypes,
    numRects: rects.length,

    linePositions,
    lineYs,
    lineColors,
    lineDirections,
    numLines: lines.length,

    arrowXs,
    arrowYs,
    arrowDirections,
    arrowHeights,
    arrowColors,
    numArrows: arrows.length,

    flatbushData,
    flatbushItems,
    subfeatureFlatbushData,
    subfeatureInfos,

    floatingLabelsData,

    maxY,
    totalHeight: maxY,
  }

  const transferables = [
    result.rectPositions.buffer,
    result.rectYs.buffer,
    result.rectHeights.buffer,
    result.rectColors.buffer,
    result.rectTypes.buffer,
    result.linePositions.buffer,
    result.lineYs.buffer,
    result.lineColors.buffer,
    result.lineDirections.buffer,
    result.arrowXs.buffer,
    result.arrowYs.buffer,
    result.arrowDirections.buffer,
    result.arrowHeights.buffer,
    result.arrowColors.buffer,
    result.flatbushData,
    result.subfeatureFlatbushData,
  ] as ArrayBuffer[]

  console.log('executeRenderWebGLFeatureData: Complete', {
    numRects: result.numRects,
    numLines: result.numLines,
    numArrows: result.numArrows,
    maxY: result.maxY,
  })

  return rpcResult(result, transferables) as any
}
