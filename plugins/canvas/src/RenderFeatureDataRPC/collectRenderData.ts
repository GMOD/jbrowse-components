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
import { packRenderArrays } from './packRenderArrays.ts'
import { aggregateAminos } from './peptides/aggregateAminoAcids.ts'
import { isLabelAllowed } from './renderConfig.ts'
import { getBoxColor, getStrokeColor, isUTR } from './util.ts'

import type { ArrowData, LineData, RectData } from './packRenderArrays.ts'
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
import type { Feat } from 'g2p_mapper'

interface RenderContext {
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
  lines: LineData[],
) {
  const feature = transcript.feature
  const start = feature.get('start')
  const end = feature.get('end')
  const lineY = transcriptTopPx + transcript.height / 2
  const strand = feature.get('strand') ?? 0
  const children = transcript.children

  if (children.length === 0) {
    lines.push({
      start,
      end,
      y: lineY,
      color: strokeUint,
      direction: strand,
      flatbushIdx,
    })
  } else {
    let prevEnd = start
    for (const child of children) {
      const childStart = child.feature.get('start')
      const childEnd = child.feature.get('end')
      if (childStart > prevEnd) {
        lines.push({
          start: prevEnd,
          end: childStart,
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
        start: prevEnd,
        end,
        y: lineY,
        color: strokeUint,
        direction: strand,
        flatbushIdx,
      })
    }
  }
}

function emitCodonRects(
  aminoAcids: AggregatedAminoAcid[],
  baseColor: string,
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
      start: aa.startBp,
      end: aa.endBp,
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

function rangeLine(type: string | undefined, start: number, end: number) {
  return `${type ? `${type}: ` : ''}${start.toLocaleString()}-${end.toLocaleString()}`
}

function buildTranscriptTooltip(args: {
  parentName: string | undefined
  transcriptName: string | undefined
  transcriptType: string | undefined
  transcriptStart: number
  transcriptEnd: number
}) {
  const {
    parentName,
    transcriptName,
    transcriptType,
    transcriptStart,
    transcriptEnd,
  } = args
  const parts: string[] = []
  if (parentName) {
    parts.push(`Gene: ${parentName}`)
  }
  if (transcriptName) {
    parts.push(`Transcript: ${transcriptName}`)
  }
  parts.push(rangeLine(transcriptType, transcriptStart, transcriptEnd))
  return parts.join('\n')
}

function buildFeatureTooltip(args: {
  name: string | undefined
  description: string | undefined
  featureType: string | undefined
  featureStart: number
  featureEnd: number
}) {
  const { name, description, featureType, featureStart, featureEnd } = args
  if (name) {
    return `${name}${description ? ` - ${description}` : ''}`
  }
  return rangeLine(featureType, featureStart, featureEnd)
}

function boxColor(feature: Feature, ctx: RenderContext) {
  return getBoxColor({
    feature,
    config: ctx.config,
    colorByCDS: ctx.colorByCDS,
    theme: ctx.theme,
  })
}

function strokeColor(feature: Feature, ctx: RenderContext) {
  return getStrokeColor({ feature, config: ctx.config, theme: ctx.theme })
}

function featureToFeat(f: Feature): Feat {
  return {
    refName: f.get('refName'),
    start: f.get('start'),
    end: f.get('end'),
    type: f.get('type'),
    strand: f.get('strand'),
    phase: f.get('phase'),
    subfeatures: f.get('subfeatures')?.map(featureToFeat),
  }
}

function pushBoxRect(
  feature: Feature,
  baseTopPx: number,
  baseHeight: number,
  flatbushIdx: number,
  ctx: RenderContext,
  rects: RectData[],
) {
  const [y, height] = applyUTRSizing(baseTopPx, baseHeight, isUTR(feature))
  rects.push({
    start: feature.get('start'),
    end: feature.get('end'),
    y,
    height,
    color: colorToUint32(boxColor(feature, ctx)),
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
    g2p = genomeToTranscriptSeqMapping(featureToFeat(transcriptFeature)).g2p
  }

  for (const childLayout of transcript.children) {
    const childFeature = childLayout.feature
    const childStart = childFeature.get('start')
    const childEnd = childFeature.get('end')
    const childIsUTR = isUTR(childFeature)
    const childType = childFeature.get('type')

    const aminoAcids =
      childType === 'CDS' && g2p && protein
        ? aggregateAminos(protein, g2p, childStart, childEnd, transcriptStrand)
        : undefined

    if (aminoAcids?.length) {
      const [childTopPx, childHeight] = applyUTRSizing(
        transcriptTopPx,
        transcript.height,
        childIsUTR,
      )
      emitCodonRects(
        aminoAcids,
        boxColor(childFeature, ctx),
        childTopPx,
        childHeight,
        flatbushIdx,
        collector.rects,
        collector.aminoAcidOverlay,
      )
    } else {
      pushBoxRect(
        childFeature,
        transcriptTopPx,
        transcript.height,
        flatbushIdx,
        ctx,
        collector.rects,
      )
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
  const transcriptStrand = transcriptFeature.get('strand') ?? 0
  const strokeUint = colorToUint32(strokeColor(transcriptFeature, ctx))

  emitIntronLines(
    transcript,
    transcriptTopPx,
    strokeUint,
    flatbushIdx,
    collector.lines,
  )

  emitExonRects(transcript, transcriptTopPx, ctx, flatbushIdx, collector)

  // Transcript metadata: subfeature hit info + floating label
  const transcriptStart = transcriptFeature.get('start')
  const transcriptEnd = transcriptFeature.get('end')
  const transcriptType = transcriptFeature.get('type')
  const parentName = getFeatureName(parentFeature)
  const transcriptName = getFeatureName(transcriptFeature)
  const tooltip = buildTranscriptTooltip({
    parentName,
    transcriptName,
    transcriptType,
    transcriptStart,
    transcriptEnd,
  })

  collector.subfeatureInfos.push({
    kind: 'subfeature',
    featureId: transcriptFeature.id(),
    parentFeatureId: parentFeature.id(),
    type: transcriptType,
    startBp: transcriptStart,
    endBp: transcriptEnd,
    topPx: transcriptTopPx,
    bottomPx: transcriptTopPx + transcript.totalLayoutHeight,
    displayLabel: transcriptName,
    tooltip,
  })

  const { config } = ctx
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
    collector.floatingLabelsData[transcriptFeature.id()] = {
      featureId: transcriptFeature.id(),
      minX: transcriptStart,
      maxX: transcriptEnd,
      topY: transcriptTopPx,
      featureHeight: transcript.height,
      parentFeatureId: result.parentFeatureId,
      subfeatureLabel: result.subfeatureLabel,
    }
  }

  if (transcriptStrand !== 0) {
    const arrowX = transcriptStrand === 1 ? transcriptEnd : transcriptStart
    collector.arrows.push({
      x: arrowX,
      y: transcriptTopPx + transcript.height / 2,
      direction: transcriptStrand,
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
      minX: featureStart,
      maxX: featureEnd,
      topY: 0,
      featureHeight: layout.height,
      nameLabel,
      descriptionLabel,
    }
  }

  const featureType = feature.get('type')
  const tooltip = buildFeatureTooltip({
    name,
    description,
    featureType,
    featureStart,
    featureEnd,
  })

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
    name,
    strand: strand !== 0 ? strand : undefined,
  })
  const flatbushIdx = collector.flatbushItems.length - 1

  if (isContainerLayout(layout)) {
    processTranscriptLayout(layout, 0, feature, flatbushIdx, ctx, collector)
  } else if (
    layout.glyphType === 'Subfeatures' ||
    layout.glyphType === 'MatureProteinRegion'
  ) {
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
      pushBoxRect(
        childLayout.feature,
        childLayout.y,
        childLayout.height,
        flatbushIdx,
        ctx,
        collector.rects,
      )
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
  const strand = feature.get('strand') ?? 0

  pushBoxRect(feature, 0, layout.height, flatbushIdx, ctx, collector.rects)

  if (!feature.parent?.() && strand !== 0) {
    const arrowX = strand === 1 ? feature.get('end') : feature.get('start')
    collector.arrows.push({
      x: arrowX,
      y: layout.height / 2,
      direction: strand,
      color: colorToUint32(strokeColor(feature, ctx)),
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

  const outlineColor = config.outline ? colorToUint32(config.outline) : 0

  for (const layout of layouts) {
    processFeatureRecord(layout, ctx, collector)
  }

  const packed = packRenderArrays(
    collector.rects,
    collector.lines,
    collector.arrows,
    regionStart,
    regionStart + regionWidth,
  )

  return {
    ...packed,
    outlineColor,
    floatingLabelsData: collector.floatingLabelsData,
    flatbushItems: collector.flatbushItems,
    subfeatureInfos: collector.subfeatureInfos,
    aminoAcidOverlay:
      collector.aminoAcidOverlay.length > 0
        ? collector.aminoAcidOverlay
        : undefined,
  }
}
