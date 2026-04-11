import {
  cssColorToRgba,
  formatHEX,
  parseCssColor,
} from '@jbrowse/core/util/colorBits'
import { darken, lighten } from '@mui/material'

import {
  createFeatureFloatingLabels,
  createTranscriptFloatingLabel,
} from './floatingLabels.ts'
import { getFeatureDescription, getFeatureName } from './labelUtils.ts'
import { prepareAminoAcidData } from './peptides/prepareAminoAcidData.ts'
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
import type { FeatureLayout, LayoutRecord, PeptideData } from './types.ts'
import type { JBrowseTheme as Theme } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'

export interface RectData {
  startOffset: number
  endOffset: number
  y: number
  height: number
  color: number
  flatbushIdx: number
}

export interface LineData {
  startOffset: number
  endOffset: number
  y: number
  color: number
  direction: number
  flatbushIdx: number
}

export interface ArrowData {
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

function isTranscriptLayout(layout: FeatureLayout) {
  return (
    layout.glyphType === 'ProcessedTranscript' ||
    layout.glyphType === 'Segments'
  )
}

function colorToUint32(colorStr: string) {
  const [r, g, b, a] = cssColorToRgba(colorStr)
  return (a << 24) | (b << 16) | (g << 8) | r
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
  strand: number,
  regionStart: number,
  flatbushIdx: number,
  lines: LineData[],
) {
  const feature = transcript.feature
  const start = feature.get('start')
  const end = feature.get('end')
  const lineY = transcriptTopPx + transcript.height / 2
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
  featureStart: number,
  featureEnd: number,
  strand: number,
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
  const featureLen = featureEnd - featureStart

  for (const [i, aa] of aminoAcids.entries()) {
    const bgColor = i % 2 === 1 ? color2 : color1

    let startBp: number
    let endBp: number
    if (strand === -1) {
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
      flatbushIdx,
    })

    overlayItems.push({
      startBp,
      endBp,
      aminoAcid: aa.aminoAcid,
      proteinIndex: aa.proteinIndex,
      topPx: y,
      heightPx: height,
      isStopOrNonTriplet: aa.aminoAcid === '*' || aa.length !== 3,
      flatbushIdx,
    })
  }
}

function emitExonRects(
  transcript: FeatureLayout,
  transcriptTopPx: number,
  ctx: RenderContext,
  flatbushIdx: number,
  collector: Collector,
) {
  const transcriptFeature = transcript.feature
  const transcriptStrand = (transcriptFeature.get('strand') as number) || 0
  const peptide = ctx.peptideDataMap?.get(transcriptFeature.id())

  for (const childLayout of transcript.children) {
    const childFeature = childLayout.feature
    const childStart = childFeature.get('start')
    const childEnd = childFeature.get('end')
    const childIsUTR = isUTR(childFeature)
    const childType = childFeature.get('type') as string

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

    if (childType === 'CDS' && peptide?.protein && !childIsUTR) {
      const aminoAcids = prepareAminoAcidData(
        transcriptFeature,
        peptide.protein,
        childStart,
        childEnd,
        transcriptStrand,
      )
      if (aminoAcids.length > 0) {
        emitCodonRects(
          aminoAcids,
          childColor,
          childStart,
          childEnd,
          transcriptStrand,
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

function emitTranscriptMetadata(
  transcript: FeatureLayout,
  transcriptTopPx: number,
  parentFeature: Feature,
  ctx: RenderContext,
  collector: Collector,
) {
  const transcriptFeature = transcript.feature
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
      color: 'black',
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
  const transcriptStrand = (transcriptFeature.get('strand') as number) || 0
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
    transcriptStrand,
    ctx.regionStart,
    flatbushIdx,
    collector.lines,
  )

  emitExonRects(transcript, transcriptTopPx, ctx, flatbushIdx, collector)

  emitTranscriptMetadata(
    transcript,
    transcriptTopPx,
    parentFeature,
    ctx,
    collector,
  )

  if (transcriptStrand !== 0) {
    const transcriptEnd = transcriptFeature.get('end')
    const transcriptStart = transcriptFeature.get('start')
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
  record: LayoutRecord,
  ctx: RenderContext,
  collector: Collector,
) {
  const { feature, layout, layoutHeight } = record
  const featureStart = feature.get('start')
  const featureEnd = feature.get('end')
  const strand = (feature.get('strand') as number) || 0

  const fillColor = getBoxColor({
    feature,
    config: ctx.config,
    colorByCDS: ctx.colorByCDS,
    theme: ctx.theme,
  })
  const strokeColor = getStrokeColor({
    feature,
    config: ctx.config,
    theme: ctx.theme,
  })
  const colorUint = colorToUint32(fillColor)
  const strokeUint = colorToUint32(strokeColor)

  const name = getFeatureName(feature)
  const description = getFeatureDescription(feature)
  const { nameLabel, descriptionLabel } = createFeatureFloatingLabels({
    feature,
    config: ctx.config,
    nameColor: 'black',
    descriptionColor: 'blue',
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
    layoutEndBp: featureEnd,
    topPx: 0,
    bottomPx: layoutHeight,
    featureHeightPx: layoutHeight,
    tooltip,
    name: name || undefined,
    strand: strand || undefined,
  })
  const flatbushIdx = collector.flatbushItems.length - 1

  if (isTranscriptLayout(layout)) {
    processTranscriptLayout(layout, 0, feature, flatbushIdx, ctx, collector)
  } else if (layout.glyphType === 'Subfeatures') {
    for (const childLayout of layout.children) {
      if (isTranscriptLayout(childLayout)) {
        processTranscriptLayout(
          childLayout,
          childLayout.y,
          feature,
          flatbushIdx,
          ctx,
          collector,
        )
      } else {
        const childFeature = childLayout.feature
        const childStart = childFeature.get('start')
        const childEnd = childFeature.get('end')
        const childIsUTR = isUTR(childFeature)

        const childColor = getBoxColor({
          feature: childFeature,
          config: ctx.config,
          colorByCDS: ctx.colorByCDS,
          theme: ctx.theme,
        })

        const [childTopPx, childHeight] = applyUTRSizing(
          childLayout.y,
          childLayout.height,
          childIsUTR,
        )

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
  } else {
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
      color: colorUint,
      flatbushIdx,
    })

    const isTopLevel = !feature.parent?.()
    if (isTopLevel && strand !== 0) {
      const arrowX = strand === 1 ? featureEnd : featureStart
      collector.arrows.push({
        x: arrowX - ctx.regionStart,
        y: layout.height / 2,
        direction: strand,
        height: layout.height,
        color: strokeUint,
        flatbushIdx,
      })
    }
  }
}

export function collectRenderData(
  layoutRecords: LayoutRecord[],
  regionStart: number,
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

  for (const record of layoutRecords) {
    processFeatureRecord(record, ctx, collector)
  }

  return collector
}
