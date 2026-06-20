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
import { dedupedSortedCDS } from './peptides/cdsSegments.ts'
import { readConfigValueSafe, resolveThemeColor } from './renderConfig.ts'
import { getBoxColor, getStrokeColor, hasVisibleText, isUTR } from './util.ts'

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

// CDS segments in transcription order: dedupedSortedCDS yields ascending genomic
// start, reversed here for the - strand. Shares the frameshift-guarding dedup
// with the peptide translation so protein indices align with the rendered rects.
function transcriptCDS(feature: Feature, strand: number): CdsSegment[] {
  const cds = dedupedSortedCDS(feature)
  return strand === -1 ? cds.reverse() : cds
}

function pushBoxRect(
  feature: Feature,
  baseTopPx: number,
  baseHeight: number,
  flatbushIdx: number,
  ctx: RenderContext,
  rects: RectData[],
  // packed RGBA32 override (mature-protein palette); 0 is a valid color so the
  // guard is `=== undefined`, not a falsy/`??` check
  colorOverride?: number,
) {
  const [y, height] = applyUTRSizing(baseTopPx, baseHeight, isUTR(feature))
  rects.push({
    start: feature.get('start'),
    end: feature.get('end'),
    y,
    height,
    color:
      colorOverride === undefined
        ? colorToUint32(boxColor(feature, ctx))
        : colorOverride,
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
  if (strand !== 0) {
    arrows.push({
      x: strand === 1 ? feature.get('end') : feature.get('start'),
      y: topPx + height / 2,
      direction: strand,
      color: strokeUint,
      flatbushIdx,
    })
  }
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

    // amino-acid segments key off CDS bounds, so any child matching one is
    // coding — UTR sizing never applies on this branch
    const aminoAcids = aminoAcidsBySeg?.get(`${childStart}-${childEnd}`)

    if (aminoAcids?.length) {
      emitCodonRects(
        aminoAcids,
        boxColor(childFeature, ctx),
        transcriptTopPx,
        transcript.height,
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
  if (
    config.subfeatureLabels !== 'none' &&
    transcriptName &&
    hasVisibleText(transcriptName)
  ) {
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
      processMatureProteinLayout(
        layout,
        feature,
        0,
        flatbushIdx,
        ctx,
        collector,
      )
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
    } else if (childLayout.glyphType === 'MatureProteinRegion') {
      // A polyprotein CDS nested under a container (gene → CDS → mature
      // regions); emit its stacked cleavage-product rows at the child's offset
      // rather than collapsing it to a single flat box. The container feature is
      // the top-level (root) feature for subfeature hit resolution.
      processMatureProteinLayout(
        childLayout,
        feature,
        childLayout.y,
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

// Each mature-protein region gets a distinct fill from this palette (by row
// order) so adjacent cleavage products are visually separable; matches the
// legacy CanvasFeatureRenderer.
const MATURE_PROTEIN_COLORS = [
  '#1f77b4', // blue
  '#ff7f0e', // orange
  '#2ca02c', // green
  '#d62728', // red
  '#9467bd', // purple
  '#8c564b', // brown
  '#e377c2', // pink
  '#7f7f7f', // gray
  '#bcbd22', // olive
  '#17becf', // cyan
  '#aec7e8', // light blue
  '#ffbb78', // light orange
].map(c => colorToUint32(c))

// Viral polyproteins: a CDS whose mature_protein_region children tile the ORF,
// stacked in rows by layoutMatureProteinRegion. Each child already carries its
// own y/height; draw a strand arrow on the parent CDS when it is top-level so
// it shows direction like every other glyph. baseTopPx shifts the rows when the
// CDS is nested inside a container glyph (gene → CDS → mature regions).
// rootFeature is the top-level feature (the one GetCanvasFeatureDetails resolves
// by id); each region is registered as a subfeature off it so it is individually
// hoverable and selectable.
function processMatureProteinLayout(
  layout: FeatureLayout,
  rootFeature: Feature,
  baseTopPx: number,
  flatbushIdx: number,
  ctx: RenderContext,
  collector: Collector,
) {
  for (const [i, childLayout] of layout.children.entries()) {
    const childFeature = childLayout.feature
    const topPx = baseTopPx + childLayout.y
    pushBoxRect(
      childFeature,
      topPx,
      childLayout.height,
      flatbushIdx,
      ctx,
      collector.rects,
      MATURE_PROTEIN_COLORS[i % MATURE_PROTEIN_COLORS.length],
    )
    collector.subfeatureInfos.push({
      kind: 'subfeature',
      featureId: childFeature.id(),
      parentFeatureId: rootFeature.id(),
      type: childFeature.get('type'),
      startBp: childFeature.get('start'),
      endBp: childFeature.get('end'),
      topPx,
      bottomPx: topPx + childLayout.height,
      // config-driven name so a `labels.name` override can surface e.g. the
      // GFF `product` attribute (mature peptides carry no `name`); falls back to
      // the plain name/id
      displayLabel:
        readFeatureLabels(ctx.config, childFeature, ctx.jexl).name ??
        getFeatureName(childFeature),
    })
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
