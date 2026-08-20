import {
  getTickDisplayStr,
  max,
  measureText,
  toLocale,
} from '@jbrowse/core/util'
import { bpOffsetInRegion } from '@jbrowse/core/util/Base1DUtils'
import { chooseGridPitch } from '@jbrowse/core/util/chooseGridPitch'
import { dropLoneTickLabels } from '@jbrowse/core/util/tickLabels'

import type { Dotplot1DViewModel } from '../1dview.ts'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

export interface Tick {
  type: 'major' | 'minor'
  base: number
  refName: string
  // Which displayed region this tick belongs to. Load-bearing, not decoration:
  // an axis may show the same refName in more than one displayed region (a
  // read-vs-ref dotplot's h axis is built from gatherOverlaps, so a read
  // aligned twice to one chromosome yields two regions on it), and refName
  // alone then collides — the seam dedupe would drop the second region's ticks
  // and React would see duplicate keys.
  displayedRegionIndex?: number
  // Position along the whole axis in px, before the viewport offset. Resolved
  // by `makeTicks` from the block the tick came from, which already carries its
  // own `offsetPx` — the running cumulative-bp total `calculateStaticBlocks`
  // computed on the way past.
  //
  // It used to be resolved per tick by `bpToPx`, which is a LINEAR SCAN of
  // `displayedRegions` accumulating that same total from zero. That made
  // positioning O(ticks x regions) on every pan: the axis holds one region per
  // refName, so zoomed into a contig partway down a fragmented assembly a few
  // hundred ticks each walked past every region ahead of it, every frame.
  //
  // Undefined for a base outside the REGION, which is what `bpToPx` reported by
  // returning undefined and what keeps a tick from being drawn onto the next
  // chromosome. Outside the block but inside the region is fine and must stay
  // fine: the pitch-aligned loop overshoots both block ends on purpose, and the
  // seam tick that survives the dedupe is the first block's copy — the
  // out-of-block one. Rejecting on block bounds silently dropped one tick per
  // 800px block.
  px?: number
}

export interface PositionedTick {
  tick: Tick
  alongPx: number
}

// A tick that survived clipping and thinning, and whether it gets a label.
export interface VisibleTick extends PositionedTick {
  labeled: boolean
}

// Identity of a tick within an axis: the region it belongs to plus its base.
// Shared by the seam dedupe and both axes' React keys so they agree.
export function tickKey(tick: Tick) {
  return `${tickRegion(tick)}-${tick.base}`
}

// Which region a tick numbers, for the label quorum. Same pair of fields the
// key above leads with, and for the same reason: one axis can carry a refName
// twice, and those two regions each need their own ruler rather than a shared
// quorum.
function tickRegion(tick: Tick) {
  return `${tick.displayedRegionIndex}-${tick.refName}`
}

// `pxToBp`, not a hand-rolled `start + offset`: `offset` is bp from the
// region's LEFT SCREEN EDGE, which on a reversed region is its `end`. Both
// dotplot axes routinely carry reversed regions — auto-diagonalize flips query
// regions on the vertical axis — and there the two disagree by
// `(end - start) - 2*offset`, so the tooltip named a mirrored position inside
// the right contig. pxToBp already applies that reflection; read its answer.
//
// `coord`, its 1-BASED field, not `coord0`. The ruler this tooltip reads
// against is 1-based (`tickLabel` re-adds the 1 `makeTicks` took off), so on
// coord0 the two disagreed by one: hovering the tick labelled 1,000 reported
// 999. Every other coordinate a user reads in JBrowse is 1-based too, this
// being the only place that printed the interbase one.
export function locstr(px: number, view: Dotplot1DViewModel) {
  const { assemblyName, refName, coord, oob } = view.pxToBp(px)
  return oob
    ? 'out of bounds'
    : `{${assemblyName}}${refName}:${toLocale(coord)}`
}

// One source of truth for the axis label/tick font, imported by both the
// renderer (Axes.tsx) and the border sizing here so the reserved width can
// never drift from what's actually drawn.
export const AXIS_LABEL_FONT = 10

// Cap the *displayed* refName so one long scaffold name can't blow up the axis
// margin. Only refNames are capped (tick coordinates stay exact); the full name
// is still shown on hover. Middle-elided to keep both a numbered scaffold's
// prefix and its distinguishing suffix (scaffold_1234 -> scaf…1234).
const LABEL_SIDE_CHARS = 4
export function truncateRefName(refName: string) {
  return refName.length > LABEL_SIDE_CHARS * 2 + 1
    ? `${refName.slice(0, LABEL_SIDE_CHARS)}…${refName.slice(-LABEL_SIDE_CHARS)}`
    : refName
}

// The middle elide above is only worth anything while it stays INJECTIVE over
// the names sharing an axis, and on a haplotype-resolved assembly it is not:
// `chr1_MATERNAL` and `chr10_MATERNAL`..`chr19_MATERNAL` all come out as
// `chr1…RNAL`, because both ends it preserves are the shared boilerplate and the
// part that names the chromosome is what it cuts. A whole-genome T2T-HG002
// self-dotplot therefore labelled eleven of its 23 rows identically — an axis
// that cannot say which contig a row is, which is most of what an axis is for.
//
// So the decision is made for the axis as a SET, not per name: elide only while
// no two names collide, and otherwise keep every name in full. Whole-axis rather
// than per-name because a mix of elided and full labels reads as arbitrary, and
// the margin is sized off the widest label either way.
//
// It costs axis margin exactly when it buys distinguishability — hg002v1.2 goes
// from a 55px border of `chr1…RNAL` to ~90px of `chr10_MATERNAL` — and nothing
// at all on the scaffold sets the elide was written for, where `scaf…1234` stays
// unique and stays short.
export function truncateRefNames(refNames: string[]) {
  const unique = [...new Set(refNames)]
  const elided = unique.map(truncateRefName)
  const collides = new Set(elided).size < unique.length
  return new Map(unique.map((n, i) => [n, collides ? n : elided[i]!]))
}

// The assembly title parked along each axis, centered on the plot's own length.
export const AXIS_TITLE_FONT = 11

// Middle-elide the axis title to the length of the axis it runs along. It is
// centered with textAnchor="middle" inside an SVG exactly the plot's size, so an
// over-long title is clipped at *both* ends — which for the read-vs-ref
// dotplot's synthetic `<readname>_assembly_<timestamp>` axis loses the read name
// itself, the only part worth reading. The full string stays on hover.
export function fitAxisTitle(title: string, availablePx: number) {
  const fullPx = measureText(title, AXIS_TITLE_FONT)
  if (fullPx <= availablePx) {
    return title
  }
  // Proportional estimate off the measured full width rather than a per-char
  // constant, so a wide-glyph name is not over-trusted.
  const maxChars = Math.floor((title.length * availablePx) / fullPx)
  return maxChars <= LABEL_SIDE_CHARS * 2 + 1
    ? truncateRefName(title)
    : `${title.slice(0, Math.ceil((maxChars - 1) / 2))}…${title.slice(-Math.floor((maxChars - 1) / 2))}`
}

// Fixed px an axis needs beyond its widest label: the 7px tick-label inset
// (labels anchor at border - 7) plus the rotated assembly title parked at x=12.
// The floor keeps room for that title on a short-label axis (e.g. self-vs-self
// "ctgA").
const BORDER_CHROME = 25
export const MIN_BORDER = 50

// Approximate px footprint of a block label along its axis. Two labels closer
// than this collide, so a region spanning fewer than this many px can't own an
// uncrowded label slot — the greedy hider (getBlockLabelKeysToHide) drops it.
const LABEL_PX = 12

// Axis margin px, sized to the widest label — the longer of each region's
// (truncated) refName or its exact end-coordinate tick. Only regions at least
// LABEL_PX tall on screen count: smaller ones (unplaced *_random contigs at
// whole-genome zoom) are collision-hidden and must not inflate the margin. A
// contig you zoom into grows past LABEL_PX and reclaims its space. Depends only
// on regions + zoom, never viewport width, so it stays acyclic (viewWidth =
// width - border).
//
// `labels` is the very map the axis component draws from
// (model.h/vRefNameLabels), passed in rather than rebuilt here: a margin sized
// off a different string than the one drawn is a clipped label, and the elide
// decision is taken over EVERY displayed region — not just the ones wide enough
// to be measured below — because it is a property of the axis, so a zoom that
// hides a small contig must not silently re-elide the labels that stay.
export function axisBorderPx(
  regions: { refName: string; start: number; end: number }[],
  bpPerPx: number,
  labels: Map<string, string>,
) {
  const labelWidth = max(
    regions.flatMap(r =>
      (r.end - r.start) / bpPerPx >= LABEL_PX
        ? [
            measureText(labels.get(r.refName)!, AXIS_LABEL_FONT),
            measureText(getTickDisplayStr(r.end, bpPerPx), AXIS_LABEL_FONT),
          ]
        : [],
    ),
    0,
  )
  return Math.max(labelWidth + BORDER_CHROME, MIN_BORDER)
}

// Slide each tick's axis position into the viewport. Negative or out-of-range
// results are kept so the caller can clip in one place. Shared between
// HorizontalAxis and VerticalAxis to keep their tick math identical.
//
// The whole of the per-pan tick cost is this subtraction: `makeTicks` resolved
// the axis position once, against the block, when it built the tick.
export function computeTickPositions(
  view: Dotplot1DViewModel,
  ticks: Tick[],
): PositionedTick[] {
  const { offsetPx } = view
  return ticks.flatMap(tick =>
    tick.px === undefined ? [] : [{ tick, alongPx: tick.px - offsetPx }],
  )
}

// Minimum on-screen spacing between two kept tick marks, and between two kept
// tick labels. Both sit below what `chooseGridPitch`'s 15px-minor / 60px-major
// targets produce inside a single region, so at ordinary zoom this thins
// nothing at all; it bites only where regions meet, which is where ticks from
// different coordinate origins pile up on one pixel.
//
// The label figure is a font HEIGHT, not a text width: both axes draw their tick
// labels perpendicular to the axis they run along (the horizontal one rotates
// them -90°), so what a label occupies *along* its own axis is one line of type.
const MIN_TICK_MARK_PX = 4
const MIN_TICK_LABEL_PX = AXIS_LABEL_FONT + 2

// Thin a clipped tick list down to what can be read, and say which ticks keep a
// label. This is what replaced dropping an axis' ticks wholesale past a block
// count: the labels were the thing that became illegible, but the lines went
// with them, and a whole-genome plot lost the only ruler it had.
//
// Sorted first because ticks arrive in block order while a reversed displayed
// region lays out right-to-left — its ticks descend in `alongPx`, so a single
// forward pass over the unsorted list would measure spacing across that
// discontinuity and thin the wrong ones.
//
// The spacing pass is per AXIS and the quorum below is per REGION, which is why
// they are two passes. Spacing is a question about neighbours, and a tick's
// nearest neighbour is routinely in the next chromosome; a quorum is a question
// about one chromosome's own ruler, and pitch comes from the whole axis, so at
// whole-genome zoom every chromosome catches one lone number and the axis reads
// as "500M" repeated across it.
export function thinTickPositions(positioned: PositionedTick[]): VisibleTick[] {
  const out: VisibleTick[] = []
  let lastMark = Number.NEGATIVE_INFINITY
  let lastLabel = Number.NEGATIVE_INFINITY
  const byPosition = [...positioned].sort((a, b) => a.alongPx - b.alongPx)
  for (const { tick, alongPx } of byPosition) {
    if (alongPx - lastMark >= MIN_TICK_MARK_PX) {
      lastMark = alongPx
      const labeled =
        tick.type === 'major' && alongPx - lastLabel >= MIN_TICK_LABEL_PX
      if (labeled) {
        lastLabel = alongPx
      }
      out.push({ tick, alongPx, labeled })
    }
  }
  // Only the LABELS go. The tick marks stay, so a chromosome too narrow to be
  // numbered keeps the grid that says where it starts and ends — the same
  // reason the block-count cutoff this replaced was wrong to take the lines.
  const numbered = new Set(
    dropLoneTickLabels(
      out.filter(t => t.labeled),
      t => tickRegion(t.tick),
    ),
  )
  return out.map(t =>
    t.labeled && !numbered.has(t) ? { ...t, labeled: false } : t,
  )
}

// A line drawn across the plot, at a plot-px position, keyed for React.
export interface AxisLine {
  key: string
  px: number
}

// One line per region boundary, carrying the position it draws at. Blocks that
// round to the same pixel as the previous one are dropped — at whole-genome
// zoom hundreds of scaffolds land on the same column and would stack identical
// <line> elements (visible as a darker band in SVG export).
//
// A block gives the NEAR edge of its region, so the far end of the last one is
// nobody's block and is passed separately. It is the one line bounds-checked
// here: both surfaces clip the rest away, but `farEndPx` runs thousands of px
// out at any zoom short of whole-genome, and in SVG export that is serialized
// geometry nothing can ever see.
export function regionBoundaryLines(
  blocks: ContentBlock[],
  toPx: (block: ContentBlock) => number,
  farEndPx: number,
  lengthPx: number,
) {
  const out: AxisLine[] = []
  let prev: number | undefined
  for (const block of blocks) {
    const px = toPx(block)
    if (Math.floor(px) !== prev) {
      out.push({ key: block.key, px })
      prev = Math.floor(px)
    }
  }
  if (farEndPx >= 0 && farEndPx <= lengthPx) {
    out.push({ key: 'far-end', px: farEndPx })
  }
  return out
}

// Minimum spacing between two gridlines. `chooseGridPitch` already targets
// 15px minors within a region, so inside one this drops nothing; it bites only
// where two regions meet and ticks from different coordinate origins pile onto
// one column, which in a 2D plot is a moiré rather than a dense ruler.
const MIN_GRIDLINE_PX = 12

// A gridline across the plot, at a plot-px position, in one of the ruler's two
// weights.
export interface TickLine {
  px: number
  major: boolean
}

// Which of an axis' visible ticks earn a line across the plot.
//
// Within a chromosome, the axis' own ticks in both weights — the way
// LinearGenomeView's gridlines carry its ruler down over the tracks, so the grid
// and the ruler beside it agree by construction rather than being two rules kept
// in step.
//
// But only within a chromosome the axis actually NUMBERED. Pitch is chosen for
// the whole axis, so at whole-genome zoom a short chromosome's band catches two
// or three lines from a pitch far coarser than its own span: a mix of weights
// with no major to key them to, ruling a square a few pixels wide into pieces
// that measure nothing. That is the same thing `dropLoneTickLabels` already
// decided about that chromosome's numbers, so it is decided the same way and
// from the same evidence — no number in this region, no grid in it either. It
// also means every gridline on the plot can be read back to a coordinate on the
// axis beside it, which is the whole of what a grid is for.
//
// Never doubled onto a region boundary, which draws its own stronger line at
// that pixel: the two together read as one heavier boundary, and the gridline is
// the copy carrying nothing the boundary didn't already say.
export function tickLines(
  ticks: VisibleTick[],
  toPx: (alongPx: number) => number,
  boundaries: AxisLine[],
) {
  const numbered = new Set(
    ticks.filter(t => t.labeled).map(t => tickRegion(t.tick)),
  )
  const taken = new Set(
    boundaries.flatMap(({ px }) => [
      Math.floor(px) - 1,
      Math.floor(px),
      Math.floor(px) + 1,
    ]),
  )
  const out: TickLine[] = []
  let last = Number.NEGATIVE_INFINITY
  // `thinTickPositions` sorted these by alongPx, so one forward pass measures
  // real neighbours — ascending on the horizontal axis, descending once the
  // vertical axis' `toPx` mirrors them, hence the abs.
  for (const { tick, alongPx } of ticks) {
    const px = toPx(alongPx)
    if (
      numbered.has(tickRegion(tick)) &&
      !taken.has(Math.floor(px)) &&
      Math.abs(px - last) >= MIN_GRIDLINE_PX
    ) {
      out.push({ px, major: tick.type === 'major' })
      last = px
    }
  }
  return out
}

interface Interval {
  start: number
  end: number
}

function intervalsOverlap(a: Interval, b: Interval) {
  return Math.max(a.start, b.start) < Math.min(a.end, b.end)
}

// Greedily decide which block labels to drop so the kept ones don't overlap.
// Largest blocks win their slot first; each kept label reserves the LABEL_PX
// interval ending at its on-axis position, and any later label whose interval
// intersects a reserved one is hidden.
//
// `length - offsetPx + viewOffsetPx` is the vertical axis's own label position
// (it lays out bottom-up, so this is literally `yoff` in Axes.tsx). The
// horizontal axis passes the same expression, which is the MIRROR of where it
// draws its labels (`b.offsetPx - offsetPx`). That is deliberate and safe for
// the overlap test — mirroring is an isometry, so which pairs collide is
// unchanged — but it does mean the two boundary rules below (the `end === 0`
// force-hide and the clamp at 0) land on the right edge for the horizontal axis
// and the top edge for the vertical one. Both are the edge where that axis's
// text would render outside the SVG, so don't "fix" the asymmetry by making it
// symmetric: that hides labels which currently render fine at the opposite edge.
export function getBlockLabelKeysToHide(
  blocks: ContentBlock[],
  length: number,
  viewOffsetPx: number,
) {
  const hide = new Set<string>()
  const reserved: Interval[] = []
  const byLengthDesc = [...blocks].sort(
    (a, b) => b.end - b.start - (a.end - a.start),
  )
  for (const { key, offsetPx } of byLengthDesc) {
    const end = Math.round(length - offsetPx + viewOffsetPx)
    const label = { start: Math.max(end - LABEL_PX, 0), end }
    if (end === 0 || reserved.some(r => intervalsOverlap(label, r))) {
      hide.add(key)
    } else {
      reserved.push(label)
    }
  }
  return hide
}

// Where a base sits along the axis, in the same px `bpToPx` answered with, using
// only the block it came from: a block's `offsetPx` is the cumulative-bp running
// total at the moment it was cut, and layout is linear across a whole region, so
// the offset from the block's LEFT SCREEN EDGE (`bpOffsetInRegion`, which
// measures from `end` on a reversed block) extrapolates correctly past the
// block's own bounds.
//
// Past the REGION's bounds it does not — there the next chromosome begins — so
// those return undefined, as bpToPx did. Which of a block's two bp bounds is the
// region's own depends on orientation: a reversed region's first block on screen
// holds its HIGHEST coordinate.
function tickPx(block: ContentBlock, coord: number, bpPerPx: number) {
  const {
    start,
    end,
    reversed,
    isLeftEndOfDisplayedRegion: atScreenStart,
  } = block
  const atRegionMinBp = reversed
    ? block.isRightEndOfDisplayedRegion
    : atScreenStart
  const atRegionMaxBp = reversed
    ? atScreenStart
    : block.isRightEndOfDisplayedRegion
  return (coord < start && atRegionMinBp) || (coord > end && atRegionMaxBp)
    ? undefined
    : Math.round(block.offsetPx + bpOffsetInRegion(block, coord) / bpPerPx)
}

// makeTicks stores `base` as (true base − 1); re-add the 1 here so the single
// off-by-one round-trip lives in one place shared by both axes.
export function tickLabel(tick: Tick, bpPerPx: number) {
  return getTickDisplayStr(tick.base + 1, bpPerPx)
}

// Ticks for one axis, built from staticBlocks so the count stays bounded by the
// viewport rather than by chromosome length.
//
// Two things follow from the blocks being static (1000px-aligned, several per
// region) rather than one block per region:
//
// - the pitch-aligned loop bounds overshoot each block's end and the next block
//   restarts below its own start, so the shared seam emits its ticks twice
//   unless deduped. Doubled <line>s stroke visibly darker than their neighbors
//   and the SVG export carries both copies.
// - a block's `start` is an arbitrary 1000px boundary, so it can't stand in for
//   the region start. The major tick that would collide with the refName label
//   is therefore suppressed only on the block at the region's own left end
//   (`isLeftEndOfDisplayedRegion`), measured from the edge the label is drawn
//   at — `end` for a reversed region, which lays out right-to-left.
//
// Both of those follow from this axis being one continuous SVG, which is what
// separates it from LinearGenomeView's same-named `makeTicks`: that one takes a
// single span because each of its blocks draws its own clipped ruler, so it
// overscans rather than dedupes and adds px in a second pass. The parts the two
// genuinely share are already shared — `chooseGridPitch`, and `base` as the
// 0-based coordinate that `getTickDisplayStr` labels `base+1`.
export function makeTicks(regions: ContentBlock[], bpPerPx: number) {
  const ticks: Tick[] = []
  const seen = new Set<string>()
  const gridPitch = chooseGridPitch(bpPerPx, 60, 15)
  const iterPitch = gridPitch.minorPitch || gridPitch.majorPitch
  for (const block of regions) {
    const { start, end, refName, displayedRegionIndex } = block
    // A block too narrow to host a distinguishable tick contributes none. At
    // whole-genome zoom on a fragmented assembly there are thousands of these,
    // and each would still emit at least one tick from its own coordinate
    // origin — which is what made the tick count scale with scaffold count
    // instead of with the viewport. Same principle as axisBorderPx's LABEL_PX
    // filter, and it is what makes dropping the old block-count cutoff safe.
    if ((end - start) / bpPerPx < MIN_TICK_MARK_PX) {
      continue
    }
    const labelBase = block.reversed ? end : start
    for (
      let base = Math.floor(start / iterPitch) * iterPitch;
      base < Math.ceil(end / iterPitch) * iterPitch + 1;
      base += iterPitch
    ) {
      const coord = base - 1
      const tick: Tick = {
        type: base % gridPitch.majorPitch === 0 ? 'major' : 'minor',
        base: coord,
        refName,
        displayedRegionIndex,
        px: tickPx(block, coord, bpPerPx),
      }
      // keyed on the region too, so the dedupe only ever collapses the shared
      // seam between two static blocks OF THE SAME region — not two regions
      // that happen to be on the same refName
      const key = tickKey(tick)
      if (!seen.has(key)) {
        seen.add(key)
        const underLabel =
          !!block.isLeftEndOfDisplayedRegion &&
          Math.abs(base - labelBase) <= gridPitch.minorPitch
        if (tick.type === 'minor' || !underLabel) {
          ticks.push(tick)
        }
      }
    }
  }
  return ticks
}
