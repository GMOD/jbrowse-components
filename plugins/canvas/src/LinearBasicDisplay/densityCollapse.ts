import { mergeSpans } from '../shared/mergeSpans.ts'
import { MIN_RECT_WIDTH_PX } from './components/sharedRendererConstants.ts'
import { isPlacedRow } from './rowPlacement.ts'

import type { Span } from '../shared/mergeSpans.ts'

// The density rules for sub-pixel marks: which ones the layout stops giving a
// row of their own and shares row 0 with, and which ones are drawn over deeply
// enough to be faded. Both are the same sweep at two depths (ADR-037).
//
// The packer's own geometry type is deliberately not imported — these take the
// structural subset they read, so this file is one the pack depends on rather
// than one that depends back.
interface DensityBox {
  densityFade: boolean
  startBp: number
  endBp: number
}

// A density-fade box narrower than the renderer's min-width clamp renders into
// the shared density texture (rect.slang densityAlpha) as a faded ~pixel mark.
// Gates on the box's own rendered width (not the label-padded layout span) to
// match the shader's realWidthPx < MIN_RECT_WIDTH_PX test.
export function isSubPixelFade(
  ext: { densityFade: boolean; startBp: number; endBp: number },
  bpPerPx: number,
) {
  return (
    ext.densityFade && (ext.endBp - ext.startBp) / bpPerPx < MIN_RECT_WIDTH_PX
  )
}

// The px span a feature's box actually paints, widening a sub-pixel box to the
// shader's min-draw clamp (anchored at the start, as rect.slang's
// extendToMinWidthX does). Both sides of the density-collapse overlap test go
// through this: comparing a candidate's clamped extent against a neighbor's RAW
// bp span made a sub-pixel neighbor ~0px wide, so nothing ever overlapped it.
//
// Exactly MIN_RECT_WIDTH_PX, not twice it. hpmath.slang's extendToMinWidthX
// works in clip space, where `minWidthPx * 2.0 / canvasWidth` is minWidthPx
// PIXELS (clip spans 2 units over canvasWidth px, so 1px = 2/canvasWidth) — the
// `* 2.0` there is the clip-space conversion, not a doubling. Canvas2D's
// `Math.max(MIN_RECT_WIDTH_PX, ...)` agrees. Doubling it here made every
// sub-pixel mark measure 2px wider than it paints, so marks that had room to
// collapse onto row 0 stacked instead and dense pileups packed taller than the
// fade regime intends.
//
// The anchor is the one thing that is NOT the same for every span: a degenerate
// (interbase) one is CENTERED on its coordinate rather than grown off its start
// edge, matching rect.slang's rectSpanPx `isPoint` branch, because a zero-length
// interval sits between two bases. Anchoring it at the start put the layout's
// idea of the mark a pixel right of where it paints, so a VCF insertion abutting
// a solid feature on its left read as clear of it, collapsed onto row 0, and
// painted into it.
//
// Deliberately NOT `rectSpanPx` itself, despite adr-051's one-source rule: that
// twin also snaps both edges to whole pixels, and it does so in SCREEN space,
// where the region offset has already been subtracted. Here the coordinates are
// absolute-genomic px, so snapping would quantize on a different phase — a
// different approximation, not a better one.
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

// True if [queryStart,queryEnd) overlaps any of the disjoint, sorted `merged`
// intervals. Finds the rightmost interval starting before queryEnd; because the
// set is disjoint, no earlier interval can reach queryStart if that one doesn't.
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

// The id a pile's row-0 reservation is stored under. Prefixed with a character no
// feature id can contain so it cannot collide with one, and never written to
// `layoutMap`, so nothing downstream can mistake it for a feature.
export const PILE_RESERVATION_ID = '\u0000pile@'

// The tallest row a pile occupies, which is what its reservation has to cover:
// the marks share row 0, so the space they take is the tallest one among them.
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

// A mark on some row, and the px span it paints. Sub-pixel boxes are widened to
// the renderer's min-draw clamp, which is what makes two of them overlap at all.
interface PaintedMark {
  id: string
  startPx: number
  endPx: number
}

// How deep a pile has to get before the layout stops giving each mark a row and
// shares one. Rows are pile depth exactly — the packer reserves the box the
// renderer paints, min-width clamp included — so this is a track height in
// disguise: 25 rows is ~500px in normal mode, past any default track height and
// half the autogrow ceiling.
//
// Set past what a real callset reaches at the density gate's own limit, so an
// ordinary variant track stacks in full and every allele stays visible and
// hoverable, and what collapses is a column no stack could have shown. ADR-037
// carries the measurements and why the bar is not the fade's.
const DENSITY_COLLAPSE_DEPTH = 25

// Which candidate marks the collapse claims: every one covering a point
// `minDepth` marks deep. Per mark and not per connected run of overlapping boxes,
// which was tried and reverted: a run chains through every mark within a clamped
// box of its neighbour, so one 25-deep hotspot dragged 600 SNVs spread across a
// whole view onto row 0 with only the hotspot faded — the very defect the
// reservation above exists to stop, re-created at a density the gate admits.
//
// What the run rule was really compensating for is that a collapsed mark calls no
// `addRect`, so row 0 stayed free for the stacker to hand to an overlapping
// neighbour, which then painted into the pile. `collapsedSpansPx` books that row
// instead, which is both narrower and exact.
function deeplyPiledIds(
  candidates: PaintedMark[],
  minDepth: number,
): ReadonlySet<string> {
  const piled = new Set<string>()
  addDeeplyPiledIds(candidates, piled, minDepth)
  return piled
}

// Sorted open/close events for an interval sweep over marks. Ends sort before
// starts at equal px, so half-open spans that merely touch neither share a point
// nor join a run.
function pileupEvents(marks: PaintedMark[]) {
  const events = marks.flatMap(mark => [
    { px: mark.startPx, delta: 1, id: mark.id },
    { px: mark.endPx, delta: -1, id: mark.id },
  ])
  events.sort((a, b) => a.px - b.px || a.delta - b.delta)
  return events
}

// How many marks have to cover one point of one row before they read as a pileup
// rather than as neighbours. Below it every mark draws opaque, so the lane
// answers "is this interval covered"; at or above it they draw at
// MIN_DENSITY_ALPHA and accumulate through the standard src-alpha blend, so a
// pixel's opacity tracks how many marks landed on it (see rect.slang) and the
// lane answers "how deep is the pile" instead.
//
// It has to be a threshold, and the threshold has to bite somewhere, because
// opacity cannot answer both questions at once. Depth needs headroom below
// opaque to be visible at all, so entering the fade regime always makes a region
// LIGHTER: one mark draws 1.0, and three sharing a pixel accumulate to
// 1-(1-0.3)^3 = 0.66. Adding a neighbour can only ever subtract, which inverts a
// coverage read. The question is therefore not whether to have a boundary but
// where to put it, and the answer is: past where the min-width clamp alone
// explains the overlap.
//
// 3, because 2 cannot tell "co-located" from "adjacent". `renderedSpanPx` widens
// every sub-pixel mark to MIN_RECT_WIDTH_PX, so two annotations that merely abut
// — disjoint in bp, one ending where the next begins — always overlap once
// clamped. A pair is the signature of ordinary tiled annotation, not of a pile.
// Three marks covering one point means three within ~2px however they are
// spread, which no clamp explains and no zoom can resolve.
//
// Measured on website/scripts/specs/graph-hprc.ts's repeatLane, which is read
// for how much of the interval is red and so needs the coverage answer: of the 171
// RepeatMasker elements on screen over its 180 kb, 89 are sub-pixel at a 900px
// pane, and a threshold of 2 faded 24 of them — the denser clusters rendering
// LIGHTER than their isolated neighbours, which is the inversion above, in the
// figure. At 3 nothing on screen fades, at any pane width the figure is captured
// at; the only three marks the sweep still flags anywhere sit in the fetch
// buffer, off screen, which is the decision staying local doing its job.
const PILEUP_FADE_DEPTH = 3

// Which sub-pixel marks are drawn over by their neighbours, which is the whole
// reason the fade exists: marks sharing a row and a pixel column are painted one
// on top of another, and at full opacity the ones underneath are not merely hard
// to read but *gone*, with no cue that they are there.
//
// Per ROW, off the layout the packer committed. Occlusion is what the fade
// reports and occlusion is per row — two marks the stacker put on different rows
// are both fully visible however close their columns, and asking the question any
// other way answers about something that is not on screen. It also means no
// separate notion of a "collapsed" mark has to exist for the fade to have an
// input: whatever ends up sharing row 0 gets swept, whether the mode put it there
// (`singleRow`) or the packer did.
//
// This replaced a count: fade every sub-pixel mark once a ref-group held >= 1000
// of them, else none. Three things were wrong with measuring it that way, and
// they are all the same mistake — occlusion is *local* and the count was not.
// Marks piled on one pixel occlude each other whether or not 998 more exist
// elsewhere. The count was per ref-group, so one view could draw a track at two
// different opacities, chr1 faded and chr21 not. And it counted the fetched span
// — which buffers half a viewport either side — against a threshold justified as
// "~1 mark per pixel of a typical viewport", a ratio that also moves with the
// window width. Depth keeps all three properties: it is local, it is per mark,
// and it is measured in painted pixels rather than in features fetched.
//
// A lone mark with clear space around it still renders opaque, which is what the
// count was protecting and is preserved here exactly.
//
// Only sub-pixel boxes are candidates, deliberately, so a wide feature stays
// opaque. A ~2px mark IS its own overlap, which is what makes a per-instance
// alpha read as the pileup's depth; a gene overlaps its neighbour over part of
// its length, and one instance alpha would ghost it end to end to report a
// collision at one end.
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

// An interval sweep, because "how many marks cover this point" is not answerable
// from a running max end. `open` holds the marks that
// are covering the current point and not yet flagged: the moment `depth` reaches
// the threshold every one of them is under a pileup that deep, so they all fade
// and leave the set — `depth` goes on counting them, and any mark that opens
// while it stays at or above the threshold is flagged as it arrives.
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

// Which sub-pixel marks the density collapse pins to row 0, and the px they
// paint. A mark qualifies only where nothing holding a real row is drawn over
// it: a wide feature, OR a sub-pixel one held out of the collapse because it
// carries a label. Counting the labeled sub-pixel features as solid is what
// stops an unlabeled neighbor from pinning to row 0 on top of one (a
// partially-rs-ID'd VCF at sub-pixel zoom: the named variant stacks, so the
// unnamed one must see it).
export function planDensityCollapse(
  features: ReadonlyMap<string, DensityBox>,
  labeledFeatureIds: ReadonlySet<string>,
  bpPerPx: number,
  // undefined takes DENSITY_COLLAPSE_DEPTH
  collapseDepth: number | undefined,
  // collapsed mode, where there is no stacking to opt out of
  singleRow: boolean,
) {
  // Everything the collapse could claim, before the overlap and depth tests
  // narrow it. Empty at any zoom past the min-width clamp and for a fully
  // labeled group — and everything below is then skipped, being all per-feature
  // allocation and an O(n log n) sort thrown away on every re-pack.
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
  // Merged so each overlap query is a single binary search (intersectsMerged);
  // touching spans join, so two abutting solid features read as one stretch.
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
