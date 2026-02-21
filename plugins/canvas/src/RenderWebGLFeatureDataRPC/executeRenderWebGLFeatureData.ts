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
import { measureText, updateStatus } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import Flatbush from '@jbrowse/core/util/flatbush'
import GranularRectLayout from '@jbrowse/core/util/layouts/GranularRectLayout'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { darken, lighten } from '@mui/material'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { createFeatureFloatingLabels } from './floatingLabels.ts'
import { layoutFeature } from './layout/layoutFeature.ts'
import { fetchPeptideData } from './peptides/peptideUtils.ts'
import { prepareAminoAcidData } from './peptides/prepareAminoAcidData.ts'
import { getBoxColor, getStrokeColor, isUTR } from './util.ts'
import { shouldRenderPeptideBackground } from './zoomThresholds.ts'

import type { AggregatedAminoAcid } from './peptides/aggregateAminoAcids.ts'
import type { RenderConfigContext } from './renderConfig.ts'
import type {
  AminoAcidOverlayItem,
  FeatureLabelData,
  FlatbushItem,
  FloatingLabelsDataMap,
  RenderWebGLFeatureDataArgs,
  RenderWebGLFeatureDataResult,
  SubfeatureInfo,
  WebGLFeatureDataResult,
} from './rpcTypes.ts'
import type { LayoutRecord, PeptideData } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'

interface RectData {
  startOffset: number
  endOffset: number
  y: number
  height: number
  color: number
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

function applyUTRSizing(
  topPx: number,
  height: number,
  isUTR: boolean,
): [topPx: number, height: number] {
  if (!isUTR) {
    return [topPx, height]
  }
  return [
    topPx + ((1 - UTR_HEIGHT_FRACTION) / 2) * height,
    height * UTR_HEIGHT_FRACTION,
  ]
}

function colorToUint32(colorStr: string) {
  const { r, g, b, a } = colord(colorStr).toRgb()
  return (Math.round(a * 255) << 24) | (b << 16) | (g << 8) | r
}

function writeColorBytes(out: Uint8Array, index: number, color: number) {
  const o = index * 4
  out[o] = color & 0xff
  out[o + 1] = (color >> 8) & 0xff
  out[o + 2] = (color >> 16) & 0xff
  out[o + 3] = (color >> 24) & 0xff
}

interface LayoutRecordWithLabels extends LayoutRecord {
  totalHeightWithLabels?: number
}

function emitCodonData(opts: {
  rects: RectData[]
  overlayItems: AminoAcidOverlayItem[]
  aminoAcids: AggregatedAminoAcid[]
  baseColor: string
  featureStart: number
  featureEnd: number
  regionStart: number
  y: number
  height: number
  strand: number
  reversed: boolean
}) {
  const {
    rects,
    overlayItems,
    aminoAcids,
    baseColor,
    featureStart,
    featureEnd,
    regionStart,
    y,
    height,
    strand,
    reversed,
  } = opts
  const baseHex = colord(baseColor).toHex()
  const color1 = lighten(baseHex, 0.2)
  const color2 = darken(baseHex, 0.1)
  const effectiveStrand = strand * (reversed ? -1 : 1)
  const featureLen = featureEnd - featureStart

  for (const [i, aminoAcid] of aminoAcids.entries()) {
    const aa = aminoAcid
    const bgColor = i % 2 === 1 ? color2 : color1

    let startBp: number
    let endBp: number
    if (effectiveStrand === -1) {
      startBp = featureStart + (featureLen - aa.endIndex - 1)
      endBp = featureStart + (featureLen - aa.startIndex)
    } else {
      startBp = featureStart + aa.startIndex
      endBp = featureStart + aa.endIndex + 1
    }

    rects.push({
      startOffset: Math.max(0, startBp - regionStart),
      endOffset: endBp - regionStart,
      y,
      height,
      color: colorToUint32(bgColor),
    })

    overlayItems.push({
      startBp,
      endBp,
      aminoAcid: aa.aminoAcid,
      proteinIndex: aa.proteinIndex,
      topPx: y,
      heightPx: height,
      isStopOrNonTriplet: aa.aminoAcid === '*' || aa.length !== 3,
    })
  }
}

function collectRenderData(
  layoutRecords: LayoutRecordWithLabels[],
  regionStart: number,
  config: unknown,
  configContext: RenderConfigContext,
  theme: unknown,
  reversed: boolean,
  colorByCDS: boolean,
  peptideDataMap?: Map<string, PeptideData>,
): {
  rects: RectData[]
  lines: LineData[]
  arrows: ArrowData[]
  floatingLabelsData: FloatingLabelsDataMap
  flatbushItems: FlatbushItem[]
  subfeatureInfos: SubfeatureInfo[]
  aminoAcidOverlay: AminoAcidOverlayItem[]
} {
  const rects: RectData[] = []
  const lines: LineData[] = []
  const arrows: ArrowData[] = []
  const floatingLabelsData: FloatingLabelsDataMap = {}
  const flatbushItems: FlatbushItem[] = []
  const subfeatureInfos: SubfeatureInfo[] = []
  const aminoAcidOverlay: AminoAcidOverlayItem[] = []

  for (const record of layoutRecords) {
    const { feature, layout, topPx, totalHeightWithLabels } = record
    const featureStart = feature.get('start')
    const featureEnd = feature.get('end')
    const strand = (feature.get('strand') as number) || 0

    const fillColor = getBoxColor({
      feature,
      config: config as any,
      configContext,
      colorByCDS,
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
      const transcriptStrokeColor = getStrokeColor({
        feature: transcriptFeature,
        config: config as any,
        configContext,
        theme: theme as any,
      })
      const transcriptStrokeUint = colorToUint32(transcriptStrokeColor)

      // Draw connecting line for intron gaps only (not inside boxes)
      const effectiveStrand = reversed ? -transcriptStrand : transcriptStrand
      const lineY = transcriptTopPx + transcriptLayout.height / 2
      const sortedChildren = transcriptLayout.children
      if (sortedChildren.length === 0) {
        lines.push({
          startOffset: transcriptStart - regionStart,
          endOffset: transcriptEnd - regionStart,
          y: lineY,
          color: transcriptStrokeUint,
          direction: effectiveStrand,
        })
      } else {
        let prevEnd = transcriptStart
        for (const child of sortedChildren) {
          const childStart = child.feature.get('start')
          const childEnd = child.feature.get('end')
          if (childStart > prevEnd) {
            lines.push({
              startOffset: prevEnd - regionStart,
              endOffset: childStart - regionStart,
              y: lineY,
              color: transcriptStrokeUint,
              direction: effectiveStrand,
            })
          }
          if (childEnd > prevEnd) {
            prevEnd = childEnd
          }
        }
        if (prevEnd < transcriptEnd) {
          lines.push({
            startOffset: prevEnd - regionStart,
            endOffset: transcriptEnd - regionStart,
            y: lineY,
            color: transcriptStrokeUint,
            direction: effectiveStrand,
          })
        }
      }

      // Draw children (exons, CDS, UTRs)
      const transcriptPeptide = peptideDataMap?.get(transcriptFeature.id())
      for (const childLayout of sortedChildren) {
        const childFeature = childLayout.feature
        const childStart = childFeature.get('start')
        const childEnd = childFeature.get('end')
        const childIsUTR = isUTR(childFeature)
        const childType = childFeature.get('type') as string

        const childColor = getBoxColor({
          feature: childFeature,
          config: config as any,
          configContext,
          colorByCDS,
          theme: theme as any,
        })
        const childColorUint = colorToUint32(childColor)

        const [childTopPx, childHeight] = applyUTRSizing(
          transcriptTopPx,
          transcriptLayout.height,
          childIsUTR,
        )

        // For CDS features with peptide data, emit per-codon rects
        if (childType === 'CDS' && transcriptPeptide?.protein && !childIsUTR) {
          const aminoAcids = prepareAminoAcidData(
            transcriptFeature,
            transcriptPeptide.protein,
            childStart,
            childEnd,
            transcriptStrand,
          )
          if (aminoAcids.length > 0) {
            emitCodonData({
              rects,
              overlayItems: aminoAcidOverlay,
              aminoAcids,
              baseColor: childColor,
              featureStart: childStart,
              featureEnd: childEnd,
              regionStart,
              y: childTopPx,
              height: childHeight,
              strand: transcriptStrand,
              reversed,
            })
          } else {
            rects.push({
              startOffset: childStart - regionStart,
              endOffset: childEnd - regionStart,
              y: childTopPx,
              height: childHeight,
              color: childColorUint,
            })
          }
        } else {
          rects.push({
            startOffset: childStart - regionStart,
            endOffset: childEnd - regionStart,
            y: childTopPx,
            height: childHeight,
            color: childColorUint,
          })
        }
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

          const childColor = getBoxColor({
            feature: childFeature,
            config: config as any,
            configContext,
            colorByCDS,
            theme: theme as any,
          })
          const childColorUint = colorToUint32(childColor)

          const [childTopPx, childHeight] = applyUTRSizing(
            topPx + childLayout.y,
            childLayout.height,
            childIsUTR,
          )

          rects.push({
            startOffset: childStart - regionStart,
            endOffset: childEnd - regionStart,
            y: childTopPx,
            height: childHeight,
            color: childColorUint,
          })

          // Note: We don't add simple child features to subfeatureInfos
          // Only transcript and gene level features are clickable
        }
      }
    } else {
      // Simple box feature
      const [rectTopPx, rectHeight] = applyUTRSizing(
        topPx,
        layout.height,
        isUTR(feature),
      )

      rects.push({
        startOffset: featureStart - regionStart,
        endOffset: featureEnd - regionStart,
        y: rectTopPx,
        height: rectHeight,
        color: colorUint,
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
    aminoAcidOverlay,
  }
}

export async function executeRenderWebGLFeatureData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RenderWebGLFeatureDataArgs
}): Promise<RenderWebGLFeatureDataResult> {
  const {
    sessionId,
    adapterConfig,
    displayConfig,
    region,
    bpPerPx: requestedBpPerPx,
    colorByCDS,
    sequenceAdapter,
    showOnlyGenes,
    maxFeatureCount,
    stopToken,
    statusCallback = () => {},
  } = args as RenderWebGLFeatureDataArgs & {
    statusCallback?: (msg: string) => void
  }

  const stopTokenCheck = createStopTokenChecker(stopToken)

  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  const regionWithAssembly = {
    ...region,
    assemblyName: region.assemblyName ?? '',
  }

  let featuresArray = await updateStatus(
    'Fetching features',
    statusCallback,
    () =>
      firstValueFrom(
        dataAdapter.getFeatures(regionWithAssembly).pipe(toArray()),
      ),
  )

  checkStopToken2(stopTokenCheck)

  if (showOnlyGenes) {
    featuresArray = featuresArray.filter(f => f.get('type') === 'gene')
  }

  if (maxFeatureCount !== undefined && featuresArray.length > maxFeatureCount) {
    return {
      regionTooLarge: true,
      featureCount: featuresArray.length,
    }
  }

  // Genomic positions are integers, but region bounds from the view can be fractional.
  // Use floor to get integer reference point for storing position offsets.
  const regionStart = Math.floor(region.start)
  const bpPerPx = requestedBpPerPx || 1 // Use actual zoom level for layout

  // Create a mock theme for color calculations
  const mockTheme = {
    palette: {
      text: { secondary: '#666666' },
      framesCDS: [
        null,
        { main: '#FF8080' },
        { main: '#80FF80' },
        { main: '#8080FF' },
        { main: '#8080FF' },
        { main: '#80FF80' },
        { main: '#FF8080' },
      ],
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
    subfeatureLabels: 'none',
    displayMode: 'normal',
    maxFeatureGlyphExpansion: 500,
    maxHeight: 5000,
    subParts: 'CDS,UTR,five_prime_UTR,three_prime_UTR',
    impliedUTRs: false,
    transcriptTypes: ['mRNA', 'transcript', 'primary_transcript'],
    containerTypes: ['proteoform_orf'],
    displayDirectionalChevrons: true,
    labels: {
      name: '',
      nameColor: '#f0f',
      description: '',
      descriptionColor: 'blue',
      fontSize: 12,
    },
    ...displayConfig,
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
    heightMultiplier: mockConfig.displayMode === 'compact' ? 0.6 : 1,
  }

  const features = new Map<string, Feature>()
  for (const f of featuresArray) {
    const id = f.id()
    if (!features.has(id)) {
      features.set(id, f)
    }
  }

  const { layoutRecords, maxY } = await updateStatus(
    'Computing layout',
    statusCallback,
    async () => {

      // Layout in pixel space so labels and padding don't blow up at
      // zoomed-out levels (where bpPerPx is large)
      const layout = new GranularRectLayout({ pitchX: 1 })
      const reversed = region.reversed ?? false
      const yPadding = 5
      const maxGlyphExpansion = mockConfig.maxFeatureGlyphExpansion || 500

      const records: LayoutRecordWithLabels[] = []

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
        const featureWidthPx = (featureEnd - featureStart) / bpPerPx

        const leftPaddingPx = featureLayout.leftPadding
        const rightPaddingPx =
          featureLayout.totalLayoutWidth -
          featureLayout.width -
          featureLayout.leftPadding

        // Convert feature bp bounds to pixel space for layout
        const featureStartPx = (featureStart - regionStart) / bpPerPx
        const featureEndPx = (featureEnd - regionStart) / bpPerPx

        let layoutStartPx: number
        let layoutEndPx: number
        if (reversed) {
          layoutStartPx = featureStartPx - rightPaddingPx
          layoutEndPx = featureEndPx + leftPaddingPx
        } else {
          layoutStartPx = featureStartPx - leftPaddingPx
          layoutEndPx = featureEndPx + rightPaddingPx
        }

        // Add space for labels in pixel space (naturally bounded)
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

        if (maxLabelWidth > featureWidthPx) {
          const extraPx = Math.min(
            maxLabelWidth - featureWidthPx,
            maxGlyphExpansion,
          )
          if (reversed) {
            layoutStartPx -= extraPx
          } else {
            layoutEndPx += extraPx
          }
        }

        const layoutHeight = featureLayout.height + labelHeight + yPadding
        const topPx = layout.addRect(
          feature.id(),
          layoutStartPx,
          layoutEndPx,
          layoutHeight,
          feature,
        )

        if (topPx !== null) {
          records.push({
            feature,
            layout: featureLayout,
            topPx,
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

  // Fetch peptide data when colorByCDS is enabled and zoomed in enough
  let peptideDataMap: Map<string, PeptideData> | undefined
  if (colorByCDS && sequenceAdapter && shouldRenderPeptideBackground(bpPerPx)) {
    const mockRenderProps = {
      sessionId,
      sequenceAdapter,
      colorByCDS: true,
      bpPerPx,
      regions: [
        {
          ...region,
          assemblyName: region.assemblyName ?? '',
        },
      ],
    }
    peptideDataMap = await updateStatus(
      'Fetching peptide data',
      statusCallback,
      async () =>
        fetchPeptideData(pluginManager, mockRenderProps as any, features),
    )
  }

  checkStopToken2(stopTokenCheck)

  const {
    rects,
    lines,
    arrows,
    floatingLabelsData,
    flatbushItems,
    subfeatureInfos,
    aminoAcidOverlay,
  } = await updateStatus('Collecting render data', statusCallback, () =>
    collectRenderData(
      layoutRecords,
      regionStart,
      mockConfig,
      configContext,
      mockTheme,
      region.reversed ?? false,
      !!colorByCDS,
      peptideDataMap,
    ),
  )

  checkStopToken2(stopTokenCheck)

  // Build Flatbush spatial indexes for hit detection
  let flatbushData = new ArrayBuffer(0)
  let subfeatureFlatbushData = new ArrayBuffer(0)

  if (flatbushItems.length > 0) {
    const reversed = region.reversed ?? false
    const featureIndex = new Flatbush(flatbushItems.length)
    for (const item of flatbushItems) {
      let hitStartBp = item.startBp
      let hitEndBp = item.endBp
      const labelData = floatingLabelsData[item.featureId]
      if (labelData) {
        let maxLabelWidthPx = 0
        for (const label of labelData.floatingLabels) {
          const w = measureText(label.text, 11)
          if (w > maxLabelWidthPx) {
            maxLabelWidthPx = w
          }
        }
        const featureWidthPx = (item.endBp - item.startBp) / bpPerPx
        if (maxLabelWidthPx > featureWidthPx) {
          const extraBp = (maxLabelWidthPx - featureWidthPx) * bpPerPx
          if (reversed) {
            hitStartBp -= extraBp
          } else {
            hitEndBp += extraBp
          }
        }
      }
      featureIndex.add(hitStartBp, item.topPx, hitEndBp, item.bottomPx)
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
  const rectColors = new Uint8Array(rects.length * 4)

  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i]!
    rectPositions[i * 2] = Math.max(0, rect.startOffset)
    rectPositions[i * 2 + 1] = Math.max(0, rect.endOffset)
    rectYs[i] = rect.y
    rectHeights[i] = rect.height
    writeColorBytes(rectColors, i, rect.color)
  }

  const linePositions = new Uint32Array(lines.length * 2)
  const lineYs = new Float32Array(lines.length)
  const lineColors = new Uint8Array(lines.length * 4)
  const lineDirections = new Int8Array(lines.length)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    linePositions[i * 2] = Math.max(0, line.startOffset)
    linePositions[i * 2 + 1] = Math.max(0, line.endOffset)
    lineYs[i] = line.y
    writeColorBytes(lineColors, i, line.color)
    lineDirections[i] = line.direction
  }

  const arrowXs = new Uint32Array(arrows.length)
  const arrowYs = new Float32Array(arrows.length)
  const arrowDirections = new Int8Array(arrows.length)
  const arrowHeights = new Float32Array(arrows.length)
  const arrowColors = new Uint8Array(arrows.length * 4)

  for (let i = 0; i < arrows.length; i++) {
    const arrow = arrows[i]!
    arrowXs[i] = Math.max(0, arrow.x)
    arrowYs[i] = arrow.y
    arrowDirections[i] = arrow.direction
    arrowHeights[i] = arrow.height
    writeColorBytes(arrowColors, i, arrow.color)
  }

  const result: WebGLFeatureDataResult = {
    regionStart,

    rectPositions,
    rectYs,
    rectHeights,
    rectColors,
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

    aminoAcidOverlay:
      aminoAcidOverlay.length > 0 ? aminoAcidOverlay : undefined,

    maxY,
  }

  const transferables = [
    result.rectPositions.buffer,
    result.rectYs.buffer,
    result.rectHeights.buffer,
    result.rectColors.buffer,
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

  return rpcResult(result, transferables) as any
}
