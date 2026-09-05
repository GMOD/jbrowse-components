import { LITERAL } from './colorClasses.ts'
import { ROOT_CHILD_ORDINAL } from './rpcTypes.ts'

import type { PackedPrimitives } from './rpcTypes.ts'

// `childOrdinal` is absent on a feature that stacks nothing, which reads as
// `ROOT_CHILD_ORDINAL`. `colorClass` is `LITERAL` when `color` is the color,
// else the theme class the main-thread encode resolves.
interface PrimitiveBase {
  labelRowsAbove: number
  childOrdinal?: number
  colorClass: number
  color: number
  y: number
  flatbushIdx: number
}

export interface RectData extends PrimitiveBase {
  start: number
  end: number
  height: number
  strand: number
}

export interface LineData extends PrimitiveBase {
  start: number
  end: number
  // Height of the box this intron line rides on, so the renderer can snap the
  // line onto the box's drawn center row.
  height: number
  direction: number
}

export interface ArrowData extends PrimitiveBase {
  x: number
  // Height of the box this arrow sits on, so the renderer can snap it onto the
  // box's drawn center row.
  height: number
  // In bp, because the worker never sees bpPerPx: the renderers drop the arrow
  // when this comes out narrower than ARROW_MIN_FEATURE_WIDTH_PX on screen.
  widthBp: number
  direction: number
}

// Half-open for a real span, but CLOSED at both ends for a degenerate one: a
// CRISPR cut site or motif tick is a point, and a half-open test drops one
// sitting exactly on a displayed-region seam.
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

// Length zero tells the main thread the pass is off, without a parallel boolean
// that could disagree with the array it gates. Uint8 because the count is
// transcripts within one gene.
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

// LENGTH ZERO when this region stacks no gene. `ROOT_CHILD_ORDINAL` marks the
// root feature's own primitives, which no trim may drop.
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

// LENGTH ZERO when every primitive resolved to a literal color, which the
// main-thread encode reads as "nothing to resolve here" and hands the worker's
// color lane back untouched.
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

// Filters a per-feature accumulator down to the visible bp window and packs the
// parallel typed arrays the GPU/Canvas2D renderers consume.
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
  // Arrows are points, so this window test is closed at both ends: an exclusive
  // upper bound drops the arrow of a feature ending exactly at regionEnd while
  // keeping its box.
  const visibleArrows = arrows.filter(
    a => a.x >= regionStart && a.x <= regionEnd,
  )

  const rectPositions = new Uint32Array(visibleRects.length * 2)
  const rectYs = new Float32Array(visibleRects.length)
  const rectHeights = new Float32Array(visibleRects.length)
  const rectColors = new Uint32Array(visibleRects.length)
  const rectStrands = new Float32Array(visibleRects.length)
  // Allocated here but valued by the main-thread layout, which decides the
  // dense-pileup regime per FEATURE.
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
