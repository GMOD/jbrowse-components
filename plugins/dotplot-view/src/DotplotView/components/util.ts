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

// Middle-elide `text` to about `maxPx`, keeping both ends: a numbered
// scaffold's prefix and its distinguishing suffix. At least MIN_SIDE_CHARS
// stay on each side, so no room at all still leaves a nameable stub.
const MIN_SIDE_CHARS = 6
function elideToFit(text: string, maxPx: number, fontSize: number) {
  const fullPx = measureText(text, fontSize)
  if (fullPx <= maxPx) {
    return text
  }
  const keep = Math.max(
    Math.floor((text.length * maxPx) / fullPx) - 1,
    MIN_SIDE_CHARS * 2,
  )
  return `${text.slice(0, Math.ceil(keep / 2))}…${text.slice(-Math.floor(keep / 2))}`
}

// The widest a refName prints before it is elided, so one long scaffold name
// can't blow up the axis margin; the full name is still shown on hover.
// Measured rather than counted, so a haplotype-suffixed chromosome
// (`chr10_MATERNAL`, 85px) or an hg38 alt contig prints whole, suffix and all.
const MAX_REF_NAME_PX = 90
export function truncateRefName(refName: string) {
  return elideToFit(refName, MAX_REF_NAME_PX, AXIS_LABEL_FONT)
}

// The middle elide is only worth anything while it stays INJECTIVE over the
// names sharing an axis: `chromosome1_MATERNAL` and `chromosome10_MATERNAL`
// both come out as `chromos…TERNAL`, keeping the boilerplate and cutting the
// number that names the row. So the axis decides as a SET: elide only while no
// two names collide, and otherwise keep every name in full, since a mix of
// elided and full labels reads as arbitrary and the margin is sized off the
// widest label either way.
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
  return elideToFit(title, availablePx, AXIS_TITLE_FONT)
}

// Fixed px an axis needs beyond its widest label: the 7px tick-label inset
// (labels anchor at border - 7) plus the rotated assembly title parked at x=12.
// The floor keeps room for that title on a short-label axis (e.g. self-vs-self
// "ctgA").
const BORDER_CHROME = 25
export const MIN_BORDER = 50

// Approximate px footprint of a block label along its axis. Two labels closer
// than this collide, and a region shorter than this on screen (an unplaced
// *_random contig at whole-genome zoom) does not size the margin.
const LABEL_PX = 12

interface AxisRegion {
  refName: string
  start: number
  end: number
}

function sizesMargin(region: AxisRegion, bpPerPx: number) {
  return (region.end - region.start) / bpPerPx >= LABEL_PX
}

// The least px a refName label has beside the plot (tick labels can only widen
// it): the widest label among the regions that size the margin, or what the
// minimum border leaves. A thinner region's label draws only where it fits in
// this (`getBlockLabelKeysToHide`), so it never runs past the frame.
//
// `labels` is the very map the axis component draws from (the axis'
// `refNameLabels`): a margin sized off a different string than the one drawn
// is a clipped label. The elide decision is taken over EVERY displayed region,
// because a zoom that drops a small contig from the margin must not re-elide
// the labels that stay.
export function labelRoomPx(
  regions: readonly AxisRegion[],
  bpPerPx: number,
  labels: Map<string, string>,
) {
  return max(
    regions.flatMap(r =>
      sizesMargin(r, bpPerPx)
        ? [measureText(labels.get(r.refName)!, AXIS_LABEL_FONT)]
        : [],
    ),
    MIN_BORDER - BORDER_CHROME,
  )
}

// Axis margin px: the label room, widened to the exact end-coordinate tick of
// each region that sizes it when tick labels are drawn.
//
// Reads regions + zoom and never viewport width, which makes the SAME-AXIS edge
// acyclic (viewWidth = width - borderX). It does not make the margin acyclic:
// borderX reads vview.bpPerPx, a fit-to-view vertical zoom comes off
// viewHeight = height - borderY, and borderY reads hview.bpPerPx off
// viewWidth = width - borderX, so the loop closes across the two axes.
// `showAllRegions` is what resolves it — two hand-rolled passes in one action,
// which model.ts states — and nothing re-triggers them, since no autorun
// observes a border or either viewWidth/viewHeight. So the fit converges and
// stops rather than oscillating; for grape-vs-peach it converges after the first
// pass, with the nearest LABEL_PX crossing 1.43x away in zoom.
export function axisBorderPx(
  regions: readonly AxisRegion[],
  bpPerPx: number,
  labels: Map<string, string>,
  tickLabels: boolean,
) {
  const tickWidth = tickLabels
    ? max(
        regions.flatMap(r =>
          sizesMargin(r, bpPerPx)
            ? [measureText(getTickDisplayStr(r.end, bpPerPx), AXIS_LABEL_FONT)]
            : [],
        ),
        0,
      )
    : 0
  return (
    Math.max(labelRoomPx(regions, bpPerPx, labels), tickWidth) + BORDER_CHROME
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

// Which of an axis' visible ticks earn a line across the plot: the axis' own
// ticks in both weights, the way LinearGenomeView's gridlines carry its ruler
// down over the tracks, so the grid and the ruler beside it agree by
// construction rather than being two rules kept in step.
//
// ALL OF THEM OR NONE OF THEM, decided for the axis as a set. The same call
// `truncateRefNames` makes about elision a few functions up, and for the same
// reason: a grid over one chromosome's band and not its neighbour's reads as
// arbitrary, whatever rule produced it — and the reader has no way to see that
// the rule was about ruler legibility rather than about those two chromosomes.
//
// The evidence for the axis is whether `thinTickPositions` could number ANY of
// it. That is not a proxy for what a grid needs, it is the same question:
// numbers survive only where a region holds enough of them to read as a ruler
// (`dropLoneTickLabels`), which is exactly when a grid at that pitch measures
// something. At whole-genome zoom nothing on either axis clears it — pitch comes
// from the whole genome, so every chromosome's band catches at most a lone
// coordinate — and the plot keeps only its chromosome boundaries, which is what
// it had before there was a grid at all.
//
// It does mean a sliver of the previous chromosome at the viewport edge gets
// gridlines off its own coordinate origin, at the shared pitch. That is what the
// axis' tick marks under it already do, so the two still agree.
//
// Never doubled onto a region boundary, which draws its own stronger line at
// that pixel: the two together read as one heavier boundary, and the gridline is
// the copy carrying nothing the boundary didn't already say.
export function tickLines(
  ticks: VisibleTick[],
  toPx: (alongPx: number) => number,
  boundaries: AxisLine[],
) {
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
  for (const { tick, alongPx } of ticks.some(t => t.labeled) ? ticks : []) {
    const px = toPx(alongPx)
    if (!taken.has(Math.floor(px)) && Math.abs(px - last) >= MIN_GRIDLINE_PX) {
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
// A label wider than `roomPx` (`labelRoomPx`) is dropped outright. Largest
// blocks win their slot first; each kept label reserves the LABEL_PX interval
// ending at its on-axis position, and any later label whose interval
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
  labels: Map<string, string>,
  roomPx: number,
  length: number,
  viewOffsetPx: number,
) {
  const hide = new Set<string>()
  const reserved: Interval[] = []
  const byLengthDesc = [...blocks].sort(
    (a, b) => b.end - b.start - (a.end - a.start),
  )
  for (const { key, refName, offsetPx } of byLengthDesc) {
    const end = Math.round(length - offsetPx + viewOffsetPx)
    const label = { start: Math.max(end - LABEL_PX, 0), end }
    if (
      measureText(labels.get(refName) ?? refName, AXIS_LABEL_FONT) > roomPx ||
      end === 0 ||
      reserved.some(r => intervalsOverlap(label, r))
    ) {
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
