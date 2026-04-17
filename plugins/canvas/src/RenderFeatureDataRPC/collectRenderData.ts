import {
  cssColorToABGR as colorToUint32,
  formatHEX,
  parseCssColor,
} from '@jbrowse/core/util/colorBits'
import { darken, lighten } from '@mui/material'
import { genomeToTranscriptSeqMapping } from 'g2p_mapper'

import {
  createFeatureFloatingLabels,
  createTranscriptFloatingLabel,
} from './floatingLabels.ts'
import { getFeatureDescription, getFeatureName } from './labelUtils.ts'
import { aggregateAminos } from './peptides/aggregateAminoAcids.ts'
import { isLabelAllowed } from './renderConfig.ts'
import { getBoxColor, getStrokeColor, isUTR } from './util.ts'

import type { AggregatedAminoAcid } from './peptides/aggregateAminoAcids.ts'
import type { DisplayConfig } from './renderConfig.ts'
import type {
  AminoAcidOverlayItem,
  FlatbushItem,
  FloatingLabelsDataMap,
  SubfeatureInfo,
} from './rpcTypes.ts'
import type { FeatureLayout, PeptideData } from './types.ts'
import type { JBrowseTheme as Theme } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'

interface RectData {
  startOffset: number
  endOffset: number
  y: number
  height: number
  color: number
  flatbushIdx: number
}

interface LineData {
  startOffset: number
  endOffset: number
  y: number
  color: number
  direction: number
  flatbushIdx: number
}

interface ArrowData {
  x: number
  y: number
  direction: number
  height: number
  color: number
  flatbushIdx: number
}

interface RenderContext {
  regionStart: number
  config: DisplayConfig
  theme: Theme
  colorByCDS: boolean
  peptideDataMap?: Map<string, PeptideData>
}

interface Collector {
  rects: RectData[]
  lines: LineData[]
  arrows: ArrowData[]
  floatingLabelsData: FloatingLabelsDataMap
  flatbushItems: FlatbushItem[]
  subfeatureInfos: SubfeatureInfo[]
  aminoAcidOverlay: AminoAcidOverlayItem[]
}

const UTR_HEIGHT_FRACTION = 0.65

function isContainerLayout(layout: FeatureLayout) {
  return (
    layout.glyphType === 'ProcessedTranscript' ||
    layout.glyphType === 'Segments'
  )
}

function applyUTRSizing(
  topPx: number,
  height: number,
  utr: boolean,
): [topPx: number, height: number] {
  if (!utr) {
    return [topPx, height]
  }
  return [
    topPx + ((1 - UTR_HEIGHT_FRACTION) / 2) * height,
    height * UTR_HEIGHT_FRACTION,
  ]
}

function emitIntronLines(
  transcript: FeatureLayout,
  transcriptTopPx: number,
  strokeUint: number,
  flatbushIdx: number,
  ctx: RenderContext,
  lines: LineData[],
) {
  const feature = transcript.feature
  const start = feature.get('start')
  const end = feature.get('end')
  const lineY = transcriptTopPx + transcript.height / 2
  const strand = feature.get('strand') ?? 0
  const { regionStart } = ctx
  const children = transcript.children

  if (children.length === 0) {
    lines.push({
      startOffset: start - regionStart,
      endOffset: end - regionStart,
      y: lineY,
      color: strokeUint,
      direction: strand,
      flatbushIdx,
    })
    return
  }

  let prevEnd = start
  for (const child of children) {
    const childStart = child.feature.get('start')
    const childEnd = child.feature.get('end')
    if (childStart > prevEnd) {
      lines.push({
        startOffset: prevEnd - regionStart,
        endOffset: childStart - regionStart,
        y: lineY,
        color: strokeUint,
        direction: strand,
        flatbushIdx,
      })
    }
    if (childEnd > prevEnd) {
      prevEnd = childEnd
    }
  }
  if (prevEnd < end) {
    lines.push({
      startOffset: prevEnd - regionStart,
      endOffset: end - regionStart,
      y: lineY,
      color: strokeUint,
      direction: strand,
      flatbushIdx,
    })
  }
}

function emitCodonRects(
  aminoAcids: AggregatedAminoAcid[],
  baseColor: string,
  regionStart: number,
  y: number,
  height: number,
  flatbushIdx: number,
  rects: RectData[],
  overlayItems: AminoAcidOverlayItem[],
) {
  const baseHex = formatHEX(parseCssColor(baseColor))
  const color1 = lighten(baseHex, 0.2)
  const color2 = darken(baseHex, 0.1)

  for (const [i, aa] of aminoAcids.entries()) {
    const bgColor = i % 2 === 1 ? color2 : color1
    rects.push({
      startOffset: aa.startBp - regionStart,
      endOffset: aa.endBp - regionStart,
      y,
      height,
      color: colorToUint32(bgColor),
      flatbushIdx,
    })
    overlayItems.push({
      startBp: aa.startBp,
      endBp: aa.endBp,
      aminoAcid: aa.aminoAcid,
      proteinIndex: aa.proteinIndex,
      topPx: y,
      heightPx: height,
      isStopOrNonTriplet: aa.isStopOrNonTriplet,
      flatbushIdx,
    })
  }
}

function emitChildRect(
  childLayout: FeatureLayout,
  ctx: RenderContext,
  flatbushIdx: number,
  rects: RectData[],
) {
  const childFeature = childLayout.feature
  const childStart = childFeature.get('start')
  const childEnd = childFeature.get('end')

  const childColor = getBoxColor({
    feature: childFeature,
    config: ctx.config,
    colorByCDS: ctx.colorByCDS,
    theme: ctx.theme,
  })

  const [childTopPx, childHeight] = applyUTRSizing(
    childLayout.y,
    childLayout.height,
    isUTR(childFeature),
  )

  rects.push({
    startOffset: childStart - ctx.regionStart,
    endOffset: childEnd - ctx.regionStart,
    y: childTopPx,
    height: childHeight,
    color: colorToUint32(childColor),
    flatbushIdx,
  })
}

function emitExonRects(
  transcript: FeatureLayout,
  transcriptTopPx: number,
  ctx: RenderContext,
  flatbushIdx: number,
  collector: Collector,
) {
  const transcriptFeature = transcript.feature
  const transcriptStrand = transcriptFeature.get('strand') ?? 0
  const protein = ctx.peptideDataMap?.get(transcriptFeature.id())?.protein

  let g2p: Record<number, number> | undefined
  if (protein) {
    // @ts-expect-error - g2p_mapper types
    g2p = genomeToTranscriptSeqMapping(transcriptFeature.toJSON()).g2p
  }

  for (const childLayout of transcript.children) {
    const childFeature = childLayout.feature
    const childStart = childFeature.get('start')
    const childEnd = childFeature.get('end')
    const childIsUTR = isUTR(childFeature)
    const childType = childFeature.get('type')

    const childColor = getBoxColor({
      feature: childFeature,
      config: ctx.config,
      colorByCDS: ctx.colorByCDS,
      theme: ctx.theme,
    })

    const [childTopPx, childHeight] = applyUTRSizing(
      transcriptTopPx,
      transcript.height,
      childIsUTR,
    )

    if (childType === 'CDS' && g2p && protein && !childIsUTR) {
      const aminoAcids = aggregateAminos(
        protein,
        g2p,
        childStart,
        childEnd,
        transcriptStrand,
      )
      if (aminoAcids.length > 0) {
        emitCodonRects(
          aminoAcids,
          childColor,
          ctx.regionStart,
          childTopPx,
          childHeight,
          flatbushIdx,
          collector.rects,
          collector.aminoAcidOverlay,
        )
        continue
      }
    }

    collector.rects.push({
      startOffset: childStart - ctx.regionStart,
      endOffset: childEnd - ctx.regionStart,
      y: childTopPx,
      height: childHeight,
      color: colorToUint32(childColor),
      flatbushIdx,
    })
  }
}

function processTranscriptLayout(
  transcript: FeatureLayout,
  transcriptTopPx: number,
  parentFeature: Feature,
  flatbushIdx: number,
  ctx: RenderContext,
  collector: Collector,
) {
  const transcriptFeature = transcript.feature
  const transcriptStrand = transcriptFeature.get('strand') ?? 0
  const strokeColor = getStrokeColor({
    feature: transcriptFeature,
    config: ctx.config,
    theme: ctx.theme,
  })
  const strokeUint = colorToUint32(strokeColor)

  emitIntronLines(
    transcript,
    transcriptTopPx,
    strokeUint,
    flatbushIdx,
    ctx,
    collector.lines,
  )

  emitExonRects(transcript, transcriptTopPx, ctx, flatbushIdx, collector)

  // Transcript metadata: subfeature hit info + floating label
  const transcriptStart = transcriptFeature.get('start')
  const transcriptEnd = transcriptFeature.get('end')
  const parentName = getFeatureName(parentFeature)
  const transcriptName = getFeatureName(transcriptFeature)

  const tooltipParts: string[] = []
  if (parentName) {
    tooltipParts.push(`Gene: ${parentName}`)
  }
  if (transcriptName) {
    tooltipParts.push(`Transcript: ${transcriptName}`)
  }
  tooltipParts.push(
    `${transcriptFeature.get('type') || 'transcript'}: ${transcriptStart.toLocaleString()}-${transcriptEnd.toLocaleString()}`,
  )
  const tooltip = tooltipParts.join('\n')

  collector.subfeatureInfos.push({
    kind: 'subfeature',
    featureId: transcriptFeature.id(),
    parentFeatureId: parentFeature.id(),
    type: transcriptFeature.get('type') || 'transcript',
    startBp: transcriptStart,
    endBp: transcriptEnd,
    topPx: transcriptTopPx,
    bottomPx: transcriptTopPx + transcript.totalLayoutHeight,
    displayLabel: transcriptName || 'transcript',
    tooltip,
  })

  const { config, regionStart } = ctx
  if (
    isLabelAllowed(config) &&
    config.subfeatureLabels !== 'none' &&
    transcriptName
  ) {
    const result = createTranscriptFloatingLabel({
      displayLabel: transcriptName,
      featureHeight: transcript.height,
      subfeatureLabels: config.subfeatureLabels,
      parentFeatureId: parentFeature.id(),
      tooltip,
    })
    if (result) {
      collector.floatingLabelsData[transcriptFeature.id()] = {
        featureId: transcriptFeature.id(),
        minX: transcriptStart - regionStart,
        maxX: transcriptEnd - regionStart,
        topY: transcriptTopPx,
        featureHeight: transcript.height,
        parentFeatureId: result.parentFeatureId,
        subfeatureLabel: result.subfeatureLabel,
      }
    }
  }

  if (transcriptStrand !== 0) {
    const arrowX = transcriptStrand === 1 ? transcriptEnd : transcriptStart
    collector.arrows.push({
      x: arrowX - ctx.regionStart,
      y: transcriptTopPx + transcript.height / 2,
      direction: transcriptStrand,
      height: transcript.height,
      color: strokeUint,
      flatbushIdx,
    })
  }
}

function processFeatureRecord(
  layout: FeatureLayout,
  ctx: RenderContext,
  collector: Collector,
) {
  const { feature } = layout
  const featureStart = feature.get('start')
  const featureEnd = feature.get('end')
  const strand = feature.get('strand') ?? 0

  const name = getFeatureName(feature)
  const description = getFeatureDescription(feature)
  const { nameLabel, descriptionLabel } = createFeatureFloatingLabels({
    feature,
    config: ctx.config,
    name,
    description,
  })

  if (nameLabel || descriptionLabel) {
    collector.floatingLabelsData[feature.id()] = {
      featureId: feature.id(),
      minX: featureStart - ctx.regionStart,
      maxX: featureEnd - ctx.regionStart,
      topY: 0,
      featureHeight: layout.height,
      nameLabel,
      descriptionLabel,
    }
  }

  const featureType = feature.get('type') || 'feature'
  const tooltip = name
    ? `${name}${description ? ` - ${description}` : ''}`
    : `${featureType}: ${featureStart.toLocaleString()}-${featureEnd.toLocaleString()}`

  collector.flatbushItems.push({
    kind: 'feature',
    featureId: feature.id(),
    type: featureType,
    startBp: featureStart,
    endBp: featureEnd,
    topPx: 0,
    bottomPx: layout.height,
    featureHeightPx: layout.height,
    tooltip,
    name: name || undefined,
    strand: strand !== 0 ? strand : undefined,
  })
  const flatbushIdx = collector.flatbushItems.length - 1

  if (isContainerLayout(layout)) {
    processTranscriptLayout(layout, 0, feature, flatbushIdx, ctx, collector)
  } else if (layout.glyphType === 'Subfeatures') {
    processSubfeaturesLayout(layout, flatbushIdx, ctx, collector)
  } else {
    processDefaultLayout(layout, flatbushIdx, ctx, collector)
  }
}

function processSubfeaturesLayout(
  layout: FeatureLayout,
  flatbushIdx: number,
  ctx: RenderContext,
  collector: Collector,
) {
  const { feature } = layout
  for (const childLayout of layout.children) {
    if (isContainerLayout(childLayout)) {
      processTranscriptLayout(
        childLayout,
        childLayout.y,
        feature,
        flatbushIdx,
        ctx,
        collector,
      )
    } else {
      emitChildRect(childLayout, ctx, flatbushIdx, collector.rects)
    }
  }
}

function processDefaultLayout(
  layout: FeatureLayout,
  flatbushIdx: number,
  ctx: RenderContext,
  collector: Collector,
) {
  const { feature } = layout
  const featureStart = feature.get('start')
  const featureEnd = feature.get('end')
  const strand = feature.get('strand') ?? 0

  const fillColor = getBoxColor({
    feature,
    config: ctx.config,
    colorByCDS: ctx.colorByCDS,
    theme: ctx.theme,
  })

  const [rectTopPx, rectHeight] = applyUTRSizing(
    0,
    layout.height,
    isUTR(feature),
  )

  collector.rects.push({
    startOffset: featureStart - ctx.regionStart,
    endOffset: featureEnd - ctx.regionStart,
    y: rectTopPx,
    height: rectHeight,
    color: colorToUint32(fillColor),
    flatbushIdx,
  })

  if (!feature.parent?.() && strand !== 0) {
    const strokeColor = getStrokeColor({
      feature,
      config: ctx.config,
      theme: ctx.theme,
    })
    const arrowX = strand === 1 ? featureEnd : featureStart
    collector.arrows.push({
      x: arrowX - ctx.regionStart,
      y: layout.height / 2,
      direction: strand,
      height: layout.height,
      color: colorToUint32(strokeColor),
      flatbushIdx,
    })
  }
}

export function collectRenderData(
  layouts: FeatureLayout[],
  regionStart: number,
  regionWidth: number,
  config: DisplayConfig,
  theme: Theme,
  colorByCDS: boolean,
  peptideDataMap?: Map<string, PeptideData>,
) {
  const ctx: RenderContext = {
    regionStart,
    config,
    theme,
    colorByCDS,
    peptideDataMap,
  }

  const collector: Collector = {
    rects: [],
    lines: [],
    arrows: [],
    floatingLabelsData: {},
    flatbushItems: [],
    subfeatureInfos: [],
    aminoAcidOverlay: [],
  }

  for (const layout of layouts) {
    processFeatureRecord(layout, ctx, collector)
  }

  const { rects, lines, arrows } = collector

  const visibleRects = rects.filter(
    r => r.endOffset > 0 && r.startOffset < regionWidth,
  )
  const visibleLines = lines.filter(
    l => l.endOffset > 0 && l.startOffset < regionWidth,
  )
  const visibleArrows = arrows.filter(a => a.x >= 0 && a.x < regionWidth)

  const rectPositions = new Uint32Array(visibleRects.length * 2)
  const rectYs = new Float32Array(visibleRects.length)
  const rectHeights = new Float32Array(visibleRects.length)
  // Color is already a packed RGBA32 u32 on the producer side — no need to
  // unpack into bytes here, interleaveRects copies the u32 straight to the
  // vertex buffer and the shader unpacks.
  const rectColors = new Uint32Array(visibleRects.length)
  const rectFeatureIndices = new Uint32Array(visibleRects.length)

  for (const [i, rect] of visibleRects.entries()) {
    rectPositions[i * 2] = Math.max(0, rect.startOffset)
    rectPositions[i * 2 + 1] = Math.max(0, rect.endOffset)
    rectYs[i] = rect.y
    rectHeights[i] = rect.height
    rectColors[i] = rect.color
    rectFeatureIndices[i] = rect.flatbushIdx
  }

  const linePositions = new Uint32Array(visibleLines.length * 2)
  const lineYs = new Float32Array(visibleLines.length)
  const lineColors = new Uint32Array(visibleLines.length)
  const lineDirections = new Int8Array(visibleLines.length)
  const lineFeatureIndices = new Uint32Array(visibleLines.length)

  for (const [i, line] of visibleLines.entries()) {
    linePositions[i * 2] = Math.max(0, line.startOffset)
    linePositions[i * 2 + 1] = Math.max(0, line.endOffset)
    lineYs[i] = line.y
    lineColors[i] = line.color
    lineDirections[i] = line.direction
    lineFeatureIndices[i] = line.flatbushIdx
  }

  const arrowXs = new Uint32Array(visibleArrows.length)
  const arrowYs = new Float32Array(visibleArrows.length)
  const arrowDirections = new Int8Array(visibleArrows.length)
  const arrowColors = new Uint32Array(visibleArrows.length)
  const arrowFeatureIndices = new Uint32Array(visibleArrows.length)

  for (const [i, arrow] of visibleArrows.entries()) {
    arrowXs[i] = Math.max(0, arrow.x)
    arrowYs[i] = arrow.y
    arrowDirections[i] = arrow.direction
    arrowColors[i] = arrow.color
    arrowFeatureIndices[i] = arrow.flatbushIdx
  }

  return {
    rectPositions,
    rectYs,
    rectHeights,
    rectColors,
    rectFeatureIndices,
    linePositions,
    lineYs,
    lineColors,
    lineDirections,
    lineFeatureIndices,
    arrowXs,
    arrowYs,
    arrowDirections,
    arrowColors,
    arrowFeatureIndices,
    floatingLabelsData: collector.floatingLabelsData,
    flatbushItems: collector.flatbushItems,
    subfeatureInfos: collector.subfeatureInfos,
    aminoAcidOverlay:
      collector.aminoAcidOverlay.length > 0
        ? collector.aminoAcidOverlay
        : undefined,
  }
}
