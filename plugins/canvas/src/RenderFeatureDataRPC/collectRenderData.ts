import {
  cssColorToABGR as colorToUint32,
  formatHEX,
  parseCssColor,
} from '@jbrowse/core/util/colorBits'
import { colord } from '@jbrowse/core/util/colord'
import { lighten } from '@mui/material'

import {
  createFeatureFloatingLabels,
  createTranscriptFloatingLabel,
} from './floatingLabels.ts'
import { getFeatureName, readFeatureLabels } from './labelUtils.ts'
import { packRenderArrays } from './packRenderArrays.ts'
import { aminoAcidsBySegment } from './peptides/aggregateAminoAcids.ts'
import { readConfigValueSafe, resolveThemeColor } from './renderConfig.ts'
import { getBoxColor, getStrokeColor, isCDS, isUTR } from './util.ts'

import type { ArrowData, LineData, RectData } from './packRenderArrays.ts'
import type {
  AggregatedAminoAcid,
  CdsSegment,
} from './peptides/aggregateAminoAcids.ts'
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
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

interface RenderContext {
  config: DisplayConfig
  theme: Theme
  colorByCDS: boolean
  peptideDataMap?: Map<string, PeptideData>
  // worker pluginManager's jexl instance, so a custom `mouseover` slot can call
  // plugin-registered jexl functions. Undefined in tests → default instance.
  jexl?: JexlInstance
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
  showChevrons: boolean,
) {
  const feature = transcript.feature
  const start = feature.get('start')
  const end = feature.get('end')
  const lineY = transcriptTopPx + transcript.height / 2
  // direction drives chevron rendering; 0 means draw a plain connecting line
  const direction = showChevrons ? (feature.get('strand') ?? 0) : 0

  let prevEnd = start
  for (const child of transcript.children) {
    const childStart = child.feature.get('start')
    const childEnd = child.feature.get('end')
    if (childStart > prevEnd) {
      lines.push({
        start: prevEnd,
        end: childStart,
        y: lineY,
        color: strokeUint,
        direction,
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
      direction,
      flatbushIdx,
    })
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
  const color1 = colorToUint32(lighten(baseHex, 0.5))
  const color2 = colorToUint32(lighten(baseHex, 0.35))

  for (const [i, aa] of aminoAcids.entries()) {
    rects.push({
      start: aa.startBp,
      end: aa.endBp,
      y,
      height,
      color: i % 2 === 1 ? color2 : color1,
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

// Hover tooltip = the display's `mouseover` config slot evaluated against the
// full feature (the same slot the old SVG renderer used on the main thread), so
// a custom override — including one calling a plugin-registered jexl function —
// drives the text. Done worker-side because the full feature is already here;
// shipping a large feature back just to format a string would be wasteful. A
// throwing override degrades to the feature name rather than failing the render.
function featureTooltip(feature: Feature, ctx: RenderContext) {
  return String(
    readConfigValueSafe<unknown>(
      ctx.config,
      'mouseover',
      feature,
      ctx.jexl,
      getFeatureName(feature) ?? '',
    ),
  )
}

function boxColor(feature: Feature, ctx: RenderContext) {
  return getBoxColor({
    feature,
    config: ctx.config,
    colorByCDS: ctx.colorByCDS,
    theme: ctx.theme,
    jexl: ctx.jexl,
  })
}

function strokeColor(feature: Feature, ctx: RenderContext) {
  return getStrokeColor({
    feature,
    config: ctx.config,
    theme: ctx.theme,
    jexl: ctx.jexl,
  })
}

// Feature-box outline. Empty means no outline (packed as 0). The menu toggle
// stores THEME_DERIVED_COLOR, resolved to text.primary at low alpha so the
// outline stays visible on both light and dark tracks (a fixed black outline
// vanishes on a dark background); in light mode this matches the old black-0.3.
function resolveOutlineColor(outlineColor: string, theme: Theme) {
  const faint = colord(theme.palette.text.primary).alpha(0.3).toRgbString()
  const c = resolveThemeColor(outlineColor, faint)
  return c ? colorToUint32(c) : 0
}

// CDS segments in transcription order (ascending genomic start on +, descending
// on -), deduped on start/end. Duplicate CDS rows (e.g. Gencode v36) would
// otherwise shift the translation frame; this matches the dedup the peptide
// string was translated with so protein indices align.
function transcriptCDS(feature: Feature, strand: number): CdsSegment[] {
  const seen = new Set<string>()
  const cds: CdsSegment[] = []
  for (const sub of feature.get('subfeatures') ?? []) {
    const start = sub.get('start')
    const end = sub.get('end')
    if (isCDS(sub) && start < end) {
      const key = `${start}-${end}`
      if (!seen.has(key)) {
        seen.add(key)
        cds.push({ start, end, phase: sub.get('phase') ?? 0 })
      }
    }
  }
  return cds.sort((a, b) => strand * (a.start - b.start))
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

function emitStrandArrow(
  feature: Feature,
  topPx: number,
  height: number,
  strokeUint: number,
  flatbushIdx: number,
  arrows: ArrowData[],
) {
  const strand = feature.get('strand') ?? 0
  if (strand === 0) {
    return
  }
  arrows.push({
    x: strand === 1 ? feature.get('end') : feature.get('start'),
    y: topPx + height / 2,
    direction: strand,
    color: strokeUint,
    flatbushIdx,
  })
}

// Top-level glyphs (no parent) get a strand arrow so they show direction like
// every other glyph; nested ones inherit it from their container.
function emitTopLevelStrandArrow(
  layout: FeatureLayout,
  flatbushIdx: number,
  ctx: RenderContext,
  collector: Collector,
) {
  const { feature } = layout
  if (!feature.parent?.()) {
    emitStrandArrow(
      feature,
      0,
      layout.height,
      colorToUint32(strokeColor(feature, ctx)),
      flatbushIdx,
      collector.arrows,
    )
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
  const transcriptStrand = transcriptFeature.get('strand') ?? 0
  const protein = ctx.peptideDataMap?.get(transcriptFeature.id())?.protein

  const aminoAcidsBySeg = protein
    ? aminoAcidsBySegment(
        transcriptCDS(transcriptFeature, transcriptStrand),
        protein,
        transcriptStrand,
      )
    : undefined

  for (const childLayout of transcript.children) {
    const childFeature = childLayout.feature
    const childStart = childFeature.get('start')
    const childEnd = childFeature.get('end')
    const childIsUTR = isUTR(childFeature)

    const aminoAcids = aminoAcidsBySeg?.get(`${childStart}-${childEnd}`)

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
  const strokeUint = colorToUint32(strokeColor(transcriptFeature, ctx))

  emitIntronLines(
    transcript,
    transcriptTopPx,
    strokeUint,
    flatbushIdx,
    collector.lines,
    ctx.config.displayDirectionalChevrons,
  )

  emitExonRects(transcript, transcriptTopPx, ctx, flatbushIdx, collector)

  // Transcript metadata: subfeature hit info + floating label
  const transcriptStart = transcriptFeature.get('start')
  const transcriptEnd = transcriptFeature.get('end')
  const transcriptType = transcriptFeature.get('type')
  const transcriptName = getFeatureName(transcriptFeature)

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
  })

  const { config } = ctx
  if (config.subfeatureLabels !== 'none' && transcriptName) {
    const result = createTranscriptFloatingLabel({
      displayLabel: transcriptName,
      featureHeight: transcript.height,
      subfeatureLabels: config.subfeatureLabels,
      parentFeatureId: parentFeature.id(),
      theme: ctx.theme,
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

  emitStrandArrow(
    transcriptFeature,
    transcriptTopPx,
    transcript.height,
    strokeUint,
    flatbushIdx,
    collector.arrows,
  )
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

  const { name, description } = readFeatureLabels(ctx.config, feature, ctx.jexl)
  const { nameLabel, descriptionLabel } = createFeatureFloatingLabels({
    name,
    description,
    theme: ctx.theme,
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

  collector.flatbushItems.push({
    kind: 'feature',
    featureId: feature.id(),
    type: featureType,
    startBp: featureStart,
    endBp: featureEnd,
    topPx: 0,
    bottomPx: layout.height,
    featureHeightPx: layout.height,
    tooltip: featureTooltip(feature, ctx),
    name,
    strand: strand !== 0 ? strand : undefined,
  })
  const flatbushIdx = collector.flatbushItems.length - 1

  switch (layout.glyphType) {
    case 'ProcessedTranscript':
    case 'Segments':
      processTranscriptLayout(layout, 0, feature, flatbushIdx, ctx, collector)
      break
    case 'Subfeatures':
      processSubfeaturesLayout(layout, flatbushIdx, ctx, collector)
      break
    case 'MatureProteinRegion':
      processMatureProteinLayout(layout, flatbushIdx, ctx, collector)
      break
    case 'Box':
      processDefaultLayout(layout, flatbushIdx, ctx, collector)
      break
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

// Viral polyproteins: a CDS whose mature_protein_region children tile the ORF,
// stacked in rows by layoutMatureProteinRegion. Each child already carries its
// own y/height; draw a strand arrow on the parent CDS when it is top-level so
// it shows direction like every other glyph.
function processMatureProteinLayout(
  layout: FeatureLayout,
  flatbushIdx: number,
  ctx: RenderContext,
  collector: Collector,
) {
  for (const childLayout of layout.children) {
    pushBoxRect(
      childLayout.feature,
      childLayout.y,
      childLayout.height,
      flatbushIdx,
      ctx,
      collector.rects,
    )
  }
  emitTopLevelStrandArrow(layout, flatbushIdx, ctx, collector)
}

function processDefaultLayout(
  layout: FeatureLayout,
  flatbushIdx: number,
  ctx: RenderContext,
  collector: Collector,
) {
  pushBoxRect(
    layout.feature,
    0,
    layout.height,
    flatbushIdx,
    ctx,
    collector.rects,
  )
  emitTopLevelStrandArrow(layout, flatbushIdx, ctx, collector)
}

export function collectRenderData(
  layouts: FeatureLayout[],
  regionStart: number,
  regionEnd: number,
  config: DisplayConfig,
  theme: Theme,
  colorByCDS: boolean,
  peptideDataMap?: Map<string, PeptideData>,
  jexl?: JexlInstance,
) {
  const ctx: RenderContext = {
    config,
    theme,
    colorByCDS,
    peptideDataMap,
    jexl,
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

  const outlineColor = resolveOutlineColor(config.outlineColor, theme)

  for (const layout of layouts) {
    processFeatureRecord(layout, ctx, collector)
  }

  const packed = packRenderArrays(
    collector.rects,
    collector.lines,
    collector.arrows,
    regionStart,
    regionEnd,
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
