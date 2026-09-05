import { lighten } from '@jbrowse/core/ui/palette'
import {
  cssColorToABGR as colorToUint32,
  formatHEX,
  parseCssColor,
} from '@jbrowse/core/util/colorBits'

import { LITERAL, codonStripeClass } from '../colorClasses.ts'
import { createTranscriptFloatingLabel } from '../floatingLabels.ts'
import { hasVisibleText, isUTR } from '../util.ts'
import {
  TRANSL_EXCEPT_HIGHLIGHT,
  boxColor,
  packColor,
  strokeColor,
} from './glyphColors.ts'

import type { AggregatedAminoAcid } from '../peptides/aggregateAminoAcids.ts'
import type { FeatureLayout } from '../types.ts'
import type { ClassedColor } from '../util.ts'
import type { PackedColor } from './glyphColors.ts'
import type {
  Collector,
  GlyphPlacement,
  RenderContext,
} from './renderContext.ts'
import type { Feature } from '@jbrowse/core/util'

export const UTR_HEIGHT_FRACTION = 0.65

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

// Every emitter below takes its geometry as one object and the whole
// `Collector` rather than the single array it pushes into. The object is not
// style: each of these carried three or four adjacent `number` parameters
// (topPx, height, a packed color, flatbushIdx), so any two could be swapped at a
// call site and still typecheck — and the failure is a primitive drawn at the
// wrong row, or attributed to the wrong hit-test entry, which nothing throws on.
export function emitIntronLines(
  args: {
    transcript: FeatureLayout
    topPx: number
    labelRowsAbove: number
    stroke: PackedColor
    flatbushIdx: number
    showChevrons: boolean
  },
  collector: Collector,
) {
  const { transcript, topPx, labelRowsAbove, stroke, flatbushIdx } = args
  const { showChevrons } = args
  const { lines } = collector
  const feature = transcript.feature
  const start = feature.get('start')
  const end = feature.get('end')
  const lineHeight = transcript.height
  const lineY = topPx + lineHeight / 2
  // direction drives chevron rendering; 0 means draw a plain connecting line
  const direction = showChevrons ? (feature.get('strand') ?? 0) : 0

  const pushLine = (lineStart: number, lineEnd: number) => {
    lines.push({
      start: lineStart,
      end: lineEnd,
      y: lineY,
      height: lineHeight,
      ...stroke,
      direction,
      flatbushIdx,
      labelRowsAbove,
    })
  }

  let prevEnd = start
  for (const child of transcript.children) {
    const childStart = child.feature.get('start')
    const childEnd = child.feature.get('end')
    if (childStart > prevEnd) {
      pushLine(prevEnd, childStart)
    }
    if (childEnd > prevEnd) {
      prevEnd = childEnd
    }
  }
  if (prevEnd < end) {
    pushLine(prevEnd, end)
  }
}

export function emitCodonRects(
  args: {
    aminoAcids: AggregatedAminoAcid[]
    // The CDS box's own fill, which the stripes are two tints of. Themed when
    // `colorByCDS` painted the box by reading frame, in which case there is no
    // string to lighten and the tint rides as a class of its own.
    baseColor: ClassedColor
    topPx: number
    height: number
    strand: number
    flatbushIdx: number
    labelRowsAbove: number
  },
  collector: Collector,
) {
  const { aminoAcids, baseColor, topPx: y, height, strand, flatbushIdx } = args
  const { labelRowsAbove } = args
  const { rects, aminoAcidOverlay: overlayItems } = collector
  const baseHex =
    baseColor.color === undefined
      ? undefined
      : formatHEX(parseCssColor(baseColor.color))
  const color1 =
    baseHex === undefined ? 0 : colorToUint32(lighten(baseHex, 0.5))
  const color2 =
    baseHex === undefined ? 0 : colorToUint32(lighten(baseHex, 0.35))
  const class1 = codonStripeClass(baseColor.colorClass, false)
  const class2 = codonStripeClass(baseColor.colorClass, true)

  // emitCodonRects is called once per CDS segment, so alternate by the global
  // residue index (proteinIndex), not the per-call loop index — this keeps the
  // stripe phase continuous across exon boundaries and paints both halves of a
  // codon that straddles a boundary the same color.
  for (const aa of aminoAcids) {
    const odd = aa.proteinIndex % 2 === 1
    rects.push({
      start: aa.startBp,
      end: aa.endBp,
      y,
      height,
      color: aa.isTranslExcept
        ? TRANSL_EXCEPT_HIGHLIGHT
        : odd
          ? color2
          : color1,
      colorClass: aa.isTranslExcept ? LITERAL : odd ? class2 : class1,
      strand,

      flatbushIdx,
      labelRowsAbove,
    })
    overlayItems.push({
      labelRowsAbove,
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
  args: {
    feature: Feature
    topPx: number
    height: number
    flatbushIdx: number
    labelRowsAbove: number
    // packed RGBA32 override (mature-protein palette, repeat subpart fills); 0
    // is a valid color so the guard is `=== undefined`, not a falsy/`??` check.
    // Always a literal — every override in tree is a fixed palette this plugin
    // owns, not the page theme.
    colorOverride?: number
  },
  ctx: RenderContext,
  collector: Collector,
) {
  const {
    feature,
    topPx: baseTopPx,
    height: baseHeight,
    flatbushIdx,
    labelRowsAbove,
    colorOverride,
  } = args
  const { rects } = collector
  const [y, height] = applyUTRSizing(baseTopPx, baseHeight, isUTR(feature))
  const fill: PackedColor =
    colorOverride === undefined
      ? packColor(boxColor(feature, ctx))
      : { color: colorOverride, colorClass: LITERAL }
  rects.push({
    start: feature.get('start'),
    end: feature.get('end'),
    y,
    height,
    ...fill,
    strand: feature.get('strand') ?? 0,
    flatbushIdx,
    labelRowsAbove,
  })
}

export function emitStrandArrow(
  args: {
    feature: Feature
    topPx: number
    height: number
    stroke: PackedColor
    flatbushIdx: number
    labelRowsAbove: number
  },
  collector: Collector,
) {
  const { feature, topPx, height, stroke, flatbushIdx } = args
  const { labelRowsAbove } = args
  const { arrows } = collector
  const strand = feature.get('strand') ?? 0
  if (strand !== 0) {
    const start = feature.get('start')
    const end = feature.get('end')
    arrows.push({
      x: strand === 1 ? end : start,
      y: topPx + height / 2,
      height,
      widthBp: end - start,
      direction: strand,
      color: stroke.color,
      colorClass: stroke.colorClass,
      flatbushIdx,
      labelRowsAbove,
    })
  }
}

// A glyph whose feature has no parent in the data tree gets a strand arrow so it
// shows direction; a feature nested under a parent (a gene's CDS/leaf child)
// does not — its container carries the direction. Keys off the feature's own
// parent linkage, not layout position, so a top-level layout whose feature still
// links to a parent is correctly treated as nested.
export function emitTopLevelStrandArrow(
  layout: FeatureLayout,
  place: GlyphPlacement,
  ctx: RenderContext,
  collector: Collector,
) {
  const { feature } = layout
  if (!feature.parent?.()) {
    emitStrandArrow(
      {
        feature,
        topPx: place.baseTopPx,
        height: layout.height,
        stroke: strokeColor(feature, ctx),
        flatbushIdx: place.flatbushIdx,
        labelRowsAbove: place.labelRowsAbove,
      },
      collector,
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
    labelRowsAbove: number
    parentFeatureId: string
  },
  ctx: RenderContext,
  collector: Collector,
) {
  const { config } = ctx
  const { featureId, displayLabel, featureHeight, minX, maxX, topY } = args
  if (config.subfeatureLabels !== 'none' && hasVisibleText(displayLabel)) {
    const result = createTranscriptFloatingLabel({
      displayLabel,
      featureHeight,
      subfeatureLabels: config.subfeatureLabels,
      parentFeatureId: args.parentFeatureId,
    })
    // Merge, don't replace: FeatureLabelData carries name/description and
    // subfeature labels together, so preserve any name/description entry already
    // recorded for this id rather than clobbering it.
    collector.floatingLabelsData.set(featureId, {
      ...collector.floatingLabelsData.get(featureId),
      featureId,
      minX,
      maxX,
      topY,
      labelRowsAbove: args.labelRowsAbove,
      featureHeight,
      parentFeatureId: result.parentFeatureId,
      subfeatureLabel: result.subfeatureLabel,
    })
  }
}
