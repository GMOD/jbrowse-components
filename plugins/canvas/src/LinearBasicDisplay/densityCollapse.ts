import { mergeSpans } from '../shared/mergeSpans.ts'
import { MIN_RECT_WIDTH_PX } from './components/sharedRendererConstants.ts'
import { isPlacedRow } from './rowPlacement.ts'

import type { Span } from '../shared/mergeSpans.ts'

// These take the structural subset they read rather than the packer's
// geometry type, so the pack depends on this file and not the reverse.
interface DensityBox {
  densityFade: boolean
  startBp: number
  endBp: number
}

// Gates on the box's own rendered width to match the shader's `realWidthPx <
// MIN_RECT_WIDTH_PX` test.
export function isSubPixelFade(
  ext: { densityFade: boolean; startBp: number; endBp: number },
  bpPerPx: number,
) {
  return (
    ext.densityFade && (ext.endBp - ext.startBp) / bpPerPx < MIN_RECT_WIDTH_PX
  )
}

// Exactly MIN_RECT_WIDTH_PX, not twice it: rect.slang's `* 2.0` is the
// clip-space conversion, and doubling here made every sub-pixel mark measure
// 2px wider than it paints. A degenerate interbase span centers on its
// coordinate like the shader's `isPoint` branch, so a VCF insertion abutting
// a solid feature reads as touching it. Not `rectSpanPx` itself: that twin
// snaps to whole screen pixels, and these coordinates are absolute-genomic
// px.
export function renderedSpanPx(
  ext: { startBp: number; endBp: number },
  bpPerPx: number,
): [number, number] {
  const startPx = ext.startBp / bpPerPx
  if (ext.endBp === ext.startBp) {
    const halfPx = MIN_RECT_WIDTH_PX / 2
    return [startPx - halfPx, startPx + halfPx]
  }
  return [startPx, Math.max(ext.endBp / bpPerPx, startPx + MIN_RECT_WIDTH_PX)]
}

// The intervals are disjoint, so if the rightmost one starting before
// queryEnd misses queryStart no earlier one can reach it.
function intersectsMerged(
  queryStart: number,
  queryEnd: number,
  merged: readonly Span[],
) {
  let lo = 0
  let hi = merged.length - 1
  let idx = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (merged[mid]![0] < queryEnd) {
      idx = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return idx >= 0 && merged[idx]![1] > queryStart
}

// Prefixed with a character no feature id can contain, and never written to
// `layoutMap`.
export const PILE_RESERVATION_ID = '\u0000pile@'

export function pileHeightPx(
  packed: ReadonlyMap<string, { height: number }>,
  collapsedFeatureIds: ReadonlySet<string>,
) {
  let tallest = 0
  for (const id of collapsedFeatureIds) {
    tallest = Math.max(tallest, packed.get(id)?.height ?? 0)
  }
  return tallest
}

interface PaintedMark {
  id: string
  startPx: number
  endPx: number
}

// Rows are pile depth, so 25 rows is ~500px in normal mode, past any default
// track height; ADR-037 carries the measurements.
const DENSITY_COLLAPSE_DEPTH = 25

// Per mark, not per connected run of overlapping boxes: a run chains through
// every mark within a clamped box of its neighbour, and one hotspot dragged
// 600 SNVs across a whole view onto row 0.
function deeplyPiledIds(
  candidates: PaintedMark[],
  minDepth: number,
): ReadonlySet<string> {
  const piled = new Set<string>()
  addDeeplyPiledIds(candidates, piled, minDepth)
  return piled
}

// Ends sort before starts at equal px, so half-open spans that merely touch
// neither share a point nor join a run.
function pileupEvents(marks: PaintedMark[]) {
  const events = marks.flatMap(mark => [
    { px: mark.startPx, delta: 1, id: mark.id },
    { px: mark.endPx, delta: -1, id: mark.id },
  ])
  events.sort((a, b) => a.px - b.px || a.delta - b.delta)
  return events
}

// 3, because 2 cannot tell co-located from adjacent: `renderedSpanPx` widens
// every sub-pixel mark to MIN_RECT_WIDTH_PX, so two abutting annotations
// always overlap once clamped. ADR-037 carries the measurements.
const PILEUP_FADE_DEPTH = 3

// Per row, off the committed layout: occlusion is per row, and two marks on
// different rows are both visible however close their columns. Only sub-pixel
// boxes are candidates, so a wide feature stays opaque.
export function pileupFadeIds(
  features: ReadonlyMap<string, DensityBox>,
  layoutMap: ReadonlyMap<string, number>,
  bpPerPx: number,
): ReadonlySet<string> {
  const byRow = new Map<number, PaintedMark[]>()
  for (const [id, top] of layoutMap) {
    const geom = features.get(id)
    if (!geom || !isPlacedRow(top) || !isSubPixelFade(geom, bpPerPx)) {
      continue
    }
    const [startPx, endPx] = renderedSpanPx(geom, bpPerPx)
    let row = byRow.get(top)
    if (!row) {
      row = []
      byRow.set(top, row)
    }
    row.push({ id, startPx, endPx })
  }

  const fade = new Set<string>()
  for (const marks of byRow.values()) {
    addDeeplyPiledIds(marks, fade, PILEUP_FADE_DEPTH)
  }
  return fade
}

// Once `depth` reaches the threshold every open mark is under a pile that
// deep, so all of them fade and leave the set.
function addDeeplyPiledIds(
  marks: PaintedMark[],
  piled: Set<string>,
  minDepth: number,
) {
  const open = new Set<string>()
  let depth = 0
  for (const { delta, id } of pileupEvents(marks)) {
    if (delta === -1) {
      depth--
      open.delete(id)
      continue
    }
    depth++
    open.add(id)
    if (depth >= minDepth) {
      for (const openId of open) {
        piled.add(openId)
      }
      open.clear()
    }
  }
}

// Labeled sub-pixel features count as solid, so an unlabeled neighbour cannot
// pin to row 0 on top of one.
export function planDensityCollapse(
  features: ReadonlyMap<string, DensityBox>,
  labeledFeatureIds: ReadonlySet<string>,
  bpPerPx: number,
  collapseDepth: number | undefined,
  singleRow: boolean,
) {
  const eligible: [string, DensityBox][] = []
  if (!singleRow) {
    for (const [id, geom] of features) {
      if (isSubPixelFade(geom, bpPerPx) && !labeledFeatureIds.has(id)) {
        eligible.push([id, geom])
      }
    }
  }

  const solidSpansPx: Span[] = []
  if (eligible.length > 0) {
    for (const [id, geom] of features) {
      if (!isSubPixelFade(geom, bpPerPx) || labeledFeatureIds.has(id)) {
        solidSpansPx.push(renderedSpanPx(geom, bpPerPx))
      }
    }
  }
  const solid = mergeSpans(solidSpansPx)
  const candidates: PaintedMark[] = []
  for (const [id, geom] of eligible) {
    const [startPx, endPx] = renderedSpanPx(geom, bpPerPx)
    if (!intersectsMerged(startPx, endPx, solid)) {
      candidates.push({ id, startPx, endPx })
    }
  }

  const collapsedFeatureIds = deeplyPiledIds(
    candidates,
    collapseDepth ?? DENSITY_COLLAPSE_DEPTH,
  )
  return {
    collapsedFeatureIds,
    collapsedSpansPx: mergeSpans(
      candidates
        .filter(mark => collapsedFeatureIds.has(mark.id))
        .map(mark => [mark.startPx, mark.endPx] as Span),
    ),
  }
}
