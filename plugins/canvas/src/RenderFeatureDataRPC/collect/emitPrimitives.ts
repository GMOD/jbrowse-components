import {
  cssColorToABGR as colorToUint32,
  formatHEX,
  parseCssColor,
} from '@jbrowse/core/util/colorBits'
import { lighten } from '@mui/material'

import { createTranscriptFloatingLabel } from '../floatingLabels.ts'
import { hasVisibleText, isUTR } from '../util.ts'
import {
  TRANSL_EXCEPT_HIGHLIGHT,
  boxColor,
  strokeColor,
} from './glyphColors.ts'

import type { Collector, RenderContext } from './renderContext.ts'
import type { ArrowData, LineData, RectData } from '../packRenderArrays.ts'
import type { AggregatedAminoAcid } from '../peptides/aggregateAminoAcids.ts'
import type { AminoAcidOverlayItem } from '../rpcTypes.ts'
import type { FeatureLayout } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

const UTR_HEIGHT_FRACTION = 0.65

// Shrink a rect to `fraction` of its row height, keeping it vertically centered.
// Shared by UTRs and retrotransposon bodies so the geometry can't drift.
export function centerShrink(
  topPx: number,
  height: number,
  fraction: number,
): [topPx: number, height: number] {
  return [topPx + ((1 - fraction) / 2) * height, height * fraction]
}

// UTRs render thinner and vertically centered within the feature row.
function applyUTRSizing(
  topPx: number,
  height: number,
  utr: boolean,
): [topPx: number, height: number] {
  return utr
    ? centerShrink(topPx, height, UTR_HEIGHT_FRACTION)
    : [topPx, height]
}

export function emitIntronLines(
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

export function emitCodonRects(
  aminoAcids: AggregatedAminoAcid[],
  baseColor: string,
  y: number,
  height: number,
  strand: number,
  flatbushIdx: number,
  rects: RectData[],
  overlayItems: AminoAcidOverlayItem[],
) {
  const baseHex = formatHEX(parseCssColor(baseColor))
  const color1 = colorToUint32(lighten(baseHex, 0.5))
  const color2 = colorToUint32(lighten(baseHex, 0.35))

  // emitCodonRects is called once per CDS segment, so alternate by the global
  // residue index (proteinIndex), not the per-call loop index — this keeps the
  // stripe phase continuous across exon boundaries and paints both halves of a
  // codon that straddles a boundary the same color.
  for (const aa of aminoAcids) {
    rects.push({
      start: aa.startBp,
      end: aa.endBp,
      y,
      height,
      color: aa.isTranslExcept
        ? TRANSL_EXCEPT_HIGHLIGHT
        : aa.proteinIndex % 2 === 1
          ? color2
          : color1,
      strand,
      flatbushIdx,
      densityFade: false,
    })
    overlayItems.push({
      startBp: aa.startBp,
      endBp: aa.endBp,
      aminoAcid: aa.aminoAcid,
      proteinIndex: aa.proteinIndex,
      topPx: y,
      heightPx: height,
      isStopOrNonTriplet: aa.isStopOrNonTriplet,
      isTranslExcept: aa.isTranslExcept,
      flatbushIdx,
    })
  }
}

export function pushBoxRect(
  feature: Feature,
  baseTopPx: number,
  baseHeight: number,
  flatbushIdx: number,
  ctx: RenderContext,
  rects: RectData[],
  // packed RGBA32 override (mature-protein palette); 0 is a valid color so the
  // guard is `=== undefined`, not a falsy/`??` check
  colorOverride?: number,
  // only whole-feature box glyphs (not gene subfeature rects) fade when collapsed
  densityFade = false,
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
    strand: feature.get('strand') ?? 0,
    flatbushIdx,
    densityFade,
  })
}

export function emitStrandArrow(
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
export function emitTopLevelStrandArrow(
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

// Emit a floating subfeature label (transcript or mature-protein region) when
// `subfeatureLabels` is enabled and the label has visible text. Shared by the
// transcript and mature-protein layout paths so the two can't drift.
export function emitSubfeatureLabel(
  args: {
    featureId: string
    displayLabel: string | undefined
    featureHeight: number
    minX: number
    maxX: number
    topY: number
    parentFeatureId: string
  },
  ctx: RenderContext,
  collector: Collector,
) {
  const { config } = ctx
  const { featureId, displayLabel, featureHeight, minX, maxX, topY } = args
  if (
    config.subfeatureLabels !== 'none' &&
    displayLabel &&
    hasVisibleText(displayLabel)
  ) {
    const result = createTranscriptFloatingLabel({
      displayLabel,
      featureHeight,
      subfeatureLabels: config.subfeatureLabels,
      parentFeatureId: args.parentFeatureId,
      theme: ctx.theme,
    })
    // Merge, don't replace: a standalone top-level transcript already has a
    // name/description entry under this same id from processFeatureRecord, and
    // FeatureLabelData carries name/description and subfeature labels together.
    collector.floatingLabelsData[featureId] = {
      ...collector.floatingLabelsData[featureId],
      featureId,
      minX,
      maxX,
      topY,
      featureHeight,
      parentFeatureId: result.parentFeatureId,
      subfeatureLabel: result.subfeatureLabel,
    }
  }
}
