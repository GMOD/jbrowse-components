import { LITERAL } from './colorClasses.ts'
import { ROOT_CHILD_ORDINAL } from './rpcTypes.ts'

import type { PackedPrimitives } from './rpcTypes.ts'

export interface RectData {
  // `below` label rows above this primitive inside its gene; the main thread
  // spends them at the display mode's label font size (see GlyphPlacement)
  labelRowsAbove: number
  // Which of the root feature's direct children this belongs to, stamped by
  // `emitSubfeaturesGlyph` after that child's subtree is emitted. Absent on a
  // primitive of a feature that stacks nothing, which reads as
  // `ROOT_CHILD_ORDINAL`.
  childOrdinal?: number
  // `LITERAL` when `color` above is the color; otherwise the theme class the
  // main-thread encode resolves it from (see colorClasses.ts)
  colorClass: number
  start: number
  end: number
  y: number
  height: number
  color: number
  strand: number
  flatbushIdx: number
}

export interface LineData {
  // `below` label rows above this primitive inside its gene; the main thread
  // spends them at the display mode's label font size (see GlyphPlacement)
  labelRowsAbove: number
  // Which of the root feature's direct children this belongs to, stamped by
  // `emitSubfeaturesGlyph` after that child's subtree is emitted. Absent on a
  // primitive of a feature that stacks nothing, which reads as
  // `ROOT_CHILD_ORDINAL`.
  childOrdinal?: number
  // `LITERAL` when `color` above is the color; otherwise the theme class the
  // main-thread encode resolves it from (see colorClasses.ts)
  colorClass: number
  start: number
  end: number
  y: number
  // Height of the box this intron line rides on, so the renderer can snap the
  // line onto the box's drawn center row (see snapBoxCenterY).
  height: number
  color: number
  direction: number
  flatbushIdx: number
}

export interface ArrowData {
  // `below` label rows above this primitive inside its gene; the main thread
  // spends them at the display mode's label font size (see GlyphPlacement)
  labelRowsAbove: number
  // Which of the root feature's direct children this belongs to, stamped by
  // `emitSubfeaturesGlyph` after that child's subtree is emitted. Absent on a
  // primitive of a feature that stacks nothing, which reads as
  // `ROOT_CHILD_ORDINAL`.
  childOrdinal?: number
  // `LITERAL` when `color` above is the color; otherwise the theme class the
  // main-thread encode resolves it from (see colorClasses.ts)
  colorClass: number
  x: number
  y: number
  // Height of the box this arrow sits on, so the renderer can snap it onto the
  // box's drawn center row (see snapBoxCenterY).
  height: number
  // Length of the feature this arrow marks, in bp. The renderers drop the arrow
  // when this comes out narrower than ARROW_MIN_FEATURE_WIDTH_PX on screen; the
  // worker can't make that call itself since it never sees bpPerPx.
  widthBp: number
  direction: number
  color: number
  flatbushIdx: number
}

// Whether a [start,end] span is in the visible window. Half-open for a real
// span, but CLOSED at both ends for a degenerate one (start === end): those are
// points, not spans — a CRISPR cut site or a motif cut tick, which the rect
// shader widens to MIN_RECT_WIDTH_PX — and the half-open test rejects a point
// sitting exactly on either boundary, so a cut landing on a displayed-region seam
// silently never packed. Same reasoning as the arrow window below, which is a
// point test for the same reason.
function spanInWindow(
  start: number,
  end: number,
  regionStart: number,
  regionEnd: number,
) {
  return start === end
    ? start >= regionStart && start <= regionEnd
    : end > regionStart && start < regionEnd
}

// The per-primitive `below`-label-row counts, or a length-zero array when no
// primitive in this region carries one — which is the ordinary case, since
// `subfeatureLabels` defaults to `none` and only a multi-transcript gene in
// `below` mode produces a nonzero count at all. Length-zero is how the main
// thread knows the pass is off without a parallel boolean that could disagree
// with the array it gates (the same idiom as `featureDeltas` in the multi-row
// pack). Uint8 because the count is transcripts-within-one-gene; a gene with
// more than 255 labeled isoforms would clamp, which costs alignment on rows
// nothing can legibly label anyway.
function labelRowArray(items: { labelRowsAbove: number }[]) {
  if (!items.some(i => i.labelRowsAbove > 0)) {
    return new Uint8Array(0)
  }
  const out = new Uint8Array(items.length)
  for (const [i, item] of items.entries()) {
    out[i] = item.labelRowsAbove
  }
  return out
}

// Which stack child each primitive belongs to, or LENGTH ZERO when this region
// stacks no gene — the same idiom as `labelRowArray` above. `ROOT_CHILD_ORDINAL`
// for the root feature's own primitives, which no trim may drop.
function childOrdinalArray(items: { childOrdinal?: number }[]) {
  if (!items.some(i => i.childOrdinal !== undefined)) {
    return new Uint16Array(0)
  }
  const out = new Uint16Array(items.length)
  for (const [i, item] of items.entries()) {
    out[i] = item.childOrdinal ?? ROOT_CHILD_ORDINAL
  }
  return out
}

// Theme classes for one primitive kind, or LENGTH ZERO when every primitive in
// it resolved to a literal color — the same length-zero idiom as
// `labelRowArray` above, and the common case: only a CDS painted by reading
// frame and a connector taking the unset `connectorColor` default are themed.
// The main-thread encode reads the empty array as "nothing to resolve here" and
// hands the worker's color lane back untouched (see resolveColorLane).
function colorClassArray(items: { colorClass: number }[]) {
  if (!items.some(i => i.colorClass !== LITERAL)) {
    return new Uint8Array(0)
  }
  const out = new Uint8Array(items.length)
  for (const [i, item] of items.entries()) {
    out[i] = item.colorClass
  }
  return out
}

// Filters a per-feature accumulator down to the visible bp window and packs
// into the parallel typed arrays the GPU/Canvas2D renderers consume. Color
// is already a packed RGBA32 u32 on the producer side — copied straight to
// the vertex buffer, shader unpacks.
export function packRenderArrays(
  rects: RectData[],
  lines: LineData[],
  arrows: ArrowData[],
  regionStart: number,
  regionEnd: number,
): PackedPrimitives {
  const visibleRects = rects.filter(r =>
    spanInWindow(r.start, r.end, regionStart, regionEnd),
  )
  const visibleLines = lines.filter(l =>
    spanInWindow(l.start, l.end, regionStart, regionEnd),
  )
  // Arrows are points, so the window test is closed at both ends to match the
  // rects' half-open overlap test. An exclusive upper bound dropped the arrow of
  // a forward-strand feature ending exactly at regionEnd while keeping its box.
  const visibleArrows = arrows.filter(
    a => a.x >= regionStart && a.x <= regionEnd,
  )

  const rectPositions = new Uint32Array(visibleRects.length * 2)
  const rectYs = new Float32Array(visibleRects.length)
  const rectHeights = new Float32Array(visibleRects.length)
  const rectColors = new Uint32Array(visibleRects.length)
  const rectStrands = new Float32Array(visibleRects.length)
  // Allocated here but valued by the main-thread layout, which decides the
  // dense-pileup regime per FEATURE (see applyLayoutToRegion). The worker has no
  // say, so it doesn't pretend to by writing a per-rect eligibility flag.
  const rectDensityFade = new Uint32Array(visibleRects.length)
  const rectColorClasses = colorClassArray(visibleRects)
  const rectFeatureIndices = new Uint32Array(visibleRects.length)
  const rectLabelRows = labelRowArray(visibleRects)
  const rectChildOrdinals = childOrdinalArray(visibleRects)

  for (const [i, rect] of visibleRects.entries()) {
    rectPositions[i * 2] = rect.start
    rectPositions[i * 2 + 1] = rect.end
    rectYs[i] = rect.y
    rectHeights[i] = rect.height
    rectColors[i] = rect.color
    rectStrands[i] = rect.strand
    rectFeatureIndices[i] = rect.flatbushIdx
  }

  const linePositions = new Uint32Array(visibleLines.length * 2)
  const lineYs = new Float32Array(visibleLines.length)
  const lineHeights = new Float32Array(visibleLines.length)
  const lineColors = new Uint32Array(visibleLines.length)
  const lineDirections = new Int8Array(visibleLines.length)
  const lineColorClasses = colorClassArray(visibleLines)
  const lineFeatureIndices = new Uint32Array(visibleLines.length)
  const lineLabelRows = labelRowArray(visibleLines)
  const lineChildOrdinals = childOrdinalArray(visibleLines)

  for (const [i, line] of visibleLines.entries()) {
    linePositions[i * 2] = line.start
    linePositions[i * 2 + 1] = line.end
    lineYs[i] = line.y
    lineHeights[i] = line.height
    lineColors[i] = line.color
    lineDirections[i] = line.direction
    lineFeatureIndices[i] = line.flatbushIdx
  }

  const arrowXs = new Uint32Array(visibleArrows.length)
  const arrowYs = new Float32Array(visibleArrows.length)
  const arrowHeights = new Float32Array(visibleArrows.length)
  const arrowWidthsBp = new Uint32Array(visibleArrows.length)
  const arrowDirections = new Int8Array(visibleArrows.length)
  const arrowColors = new Uint32Array(visibleArrows.length)
  const arrowColorClasses = colorClassArray(visibleArrows)
  const arrowFeatureIndices = new Uint32Array(visibleArrows.length)
  const arrowLabelRows = labelRowArray(visibleArrows)
  const arrowChildOrdinals = childOrdinalArray(visibleArrows)

  for (const [i, arrow] of visibleArrows.entries()) {
    arrowXs[i] = arrow.x
    arrowYs[i] = arrow.y
    arrowHeights[i] = arrow.height
    arrowWidthsBp[i] = arrow.widthBp
    arrowDirections[i] = arrow.direction
    arrowColors[i] = arrow.color
    arrowFeatureIndices[i] = arrow.flatbushIdx
  }

  return {
    rectPositions,
    rectYs,
    rectHeights,
    rectColors,
    rectStrands,
    rectDensityFade,
    rectColorClasses,
    rectFeatureIndices,
    rectLabelRows,
    rectChildOrdinals,
    linePositions,
    lineYs,
    lineHeights,
    lineColors,
    lineDirections,
    lineColorClasses,
    lineFeatureIndices,
    lineLabelRows,
    lineChildOrdinals,
    arrowXs,
    arrowYs,
    arrowHeights,
    arrowWidthsBp,
    arrowDirections,
    arrowColors,
    arrowColorClasses,
    arrowFeatureIndices,
    arrowLabelRows,
    arrowChildOrdinals,
  }
}
