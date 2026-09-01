import { preferIncumbent } from '../syntenyHysteresis.ts'
import { followPlacedWindows } from './followAnchorWindow.ts'
import { spanBounds } from './positionViewOnSpan.ts'

import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { FollowWindow } from './followAnchorWindow.ts'
import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { Region } from '@jbrowse/core/util/types'

// Above this share of the anchor panel's pixels sitting in windows that are
// proper SUBINTERVALS of their contig, the panel is a locus straddle rather
// than an overview. An overview's windows are whole contigs but for the two the
// screen edges cut, so it does not reach the floor; a window pair either side of
// a junction is partial on both sides and scores 100%.
const MOSTLY_PARTIAL = 0.5

// A window covering all but a rounding of its contig is WHOLE. Block edges come
// off PIXELS, so a fully visible contig reports an end a hair short of its
// region's — measured on a `showAllRegions` panel where five of eight contigs
// read as cut, which is not something that panel can contain. Without the
// tolerance the gate opens on an honest overview and the coverage test, which
// that overview fails at 26-40%, demotes it.
const WHOLE_ENOUGH = 0.99

// The union earns the screen only when most of what it puts there is answer.
const MIN_COVERAGE = 0.5

// ...and having lost the screen it wins it back a little higher, because the
// two placements are the furthest apart this subsystem can put a row and the
// frame pass would otherwise flip between them across a threshold the user is
// panning along.
const COVERAGE_BAND = 0.1

export interface SpreadDecision {
  spreading: boolean
  // the contig the row is placed on instead, when it is not spreading
  onto?: string
  // and the anchor's other contigs THAT ANSWERED, whose answers are the ones not
  // shown. The reader can reach them by scrolling the anchor onto one — it
  // becomes the widest window and the rows follow it — but only if something
  // says they are there, which is the whole of what the header does with this.
  // A contig with no alignment in the file answers nothing, so scrolling onto it
  // shows nothing and naming it is advice that cannot be taken.
  elsewhere?: string[]
  // undefined when nothing measurable was placed, which is the spreading case
  coverage?: number
}

export function pxByRefName(blocks: ContentBlock[]) {
  const px = new Map<string, number>()
  for (const b of blocks) {
    px.set(b.refName, (px.get(b.refName) ?? 0) + b.widthPx)
  }
  return px
}

// Whether a window shows its whole contig, to the tolerance above. Exported so
// the debug log judges a window by the same rule the decision does.
export function coversContig(w: FollowWindow, regions: Region[]) {
  const region = regions.find(r => r.refName === w.refName)
  return (
    !!region && w.end - w.start >= (region.end - region.start) * WHOLE_ENOUGH
  )
}

/**
 * The share of the anchor panel's PIXELS that sit in a window covering less
 * than its whole contig.
 *
 * The gate on the coverage test below, and it is doing the work that coverage
 * cannot do alone: measured on grape/peach/cacao, an honest whole-genome
 * overview covers 40% of what it places at one level and 22% at the next, which
 * interleaves with the straddles it would have to be told apart from. Whole
 * contigs versus cut ones separates the two zoom regimes structurally, where no
 * threshold on coverage separates them at all.
 *
 * Pixels rather than count, since the two contigs an overview's screen edges cut
 * are a small part of it and a straddle's two are all of it.
 */
export function partialShare({
  blocks,
  regions,
  windows,
}: {
  blocks: ContentBlock[]
  regions: Region[]
  windows: FollowWindow[]
}) {
  const px = pxByRefName(blocks)
  let partial = 0
  let total = 0
  for (const w of windows) {
    const width = px.get(w.refName) ?? 0
    total += width
    if (!coversContig(w, regions)) {
      partial += width
    }
  }
  return total > 0 ? partial / total : 0
}

/**
 * How much of what the union would put on screen is an answer: the mapped bp
 * over the bp of the interval that carries them.
 *
 * The denominator comes from `spanBounds`, the same bounds `positionViewOnSpans`
 * places, so this measures the row the reader is going to get rather than an
 * approximation of it. The numerator is the spans merged per contig, since two
 * tracks answering on one contig are one stretch of screen, not two.
 */
export function spreadCoverage(regions: Region[], spans: ResolvedSpan[]) {
  const bounds = spanBounds(regions, spans)
  if (!bounds) {
    return undefined
  }
  const { lo, hi } = bounds
  let interval = 0
  for (let i = lo.index; i <= hi.index; i++) {
    const r = regions[i]
    if (r) {
      const length = r.end - r.start
      interval +=
        (i === hi.index ? hi.offset : length) - (i === lo.index ? lo.offset : 0)
    }
  }
  const mapped = followPlacedWindows(spans).reduce(
    (a, s) => a + (s.end - s.start),
    0,
  )
  return interval > 0 ? mapped / interval : undefined
}

/**
 * Whether this level's multi-contig answer is worth the screen it costs, and
 * what to do instead when it is not.
 *
 * A row placed on two answers also shows every contig between them, and on a
 * pair of chromosomes that are not neighbours in the moving row's layout that
 * is nearly all of what the reader ends up looking at — measured on
 * grape/peach/cacao at 13.9Mb of answer inside 137.6Mb of row, with two whole
 * chromosomes on screen that nothing reaches. The reader's own words for it were
 * "there is nothing that row 1 connects to from there".
 *
 * NOT SPAN-DROPPING BUT A DEMOTION. The answer for a row that cannot show both
 * is the answer for a row that was only ever shown one, which is the rung below
 * this one — so the caller falls through to it and inherits the block pick, the
 * CIGAR map, the settled resolve, `alreadyShowing` and the hysteresis already
 * there. It also removes a cliff rather than adding one: a tail at 4.9% of the
 * widest window is placed by that rung today and at 5.1% teleported into a union
 * ten times the size.
 *
 * The window kept is the WIDEST BY PIXEL, which is what the eye reads as where
 * the view is, biased toward the one already kept over the same margin the block
 * pick uses — 100% against 49% is one pan away from a coin toss, and a coin toss
 * re-flipped per settle is the same defect this replaces in a smaller spelling.
 */
export function decideSpread({
  blocks,
  stayingRegions,
  movingRegions,
  windows,
  spans,
  mapped,
  previous,
}: {
  blocks: ContentBlock[]
  stayingRegions: Region[]
  movingRegions: Region[]
  windows: FollowWindow[]
  spans: ResolvedSpan[]
  /** the anchor contigs a span came back for, from `followSpreadSpans` */
  mapped: ReadonlySet<string>
  previous?: SpreadDecision
}): SpreadDecision {
  if (
    partialShare({ blocks, regions: stayingRegions, windows }) <= MOSTLY_PARTIAL
  ) {
    return { spreading: true }
  }
  const coverage = spreadCoverage(movingRegions, spans)
  const floor =
    previous?.spreading === false ? MIN_COVERAGE + COVERAGE_BAND : MIN_COVERAGE
  if (coverage === undefined || coverage >= floor) {
    return { spreading: true, coverage }
  }
  const px = pxByRefName(blocks)
  // Among the contigs that ANSWERED, so the rung below has something to place
  // from: refused onto the widest window regardless, an unaligned contig owning
  // half the panel left every row holding, and the header saying nothing
  // aligned while `elsewhere` named two contigs that did.
  const answered = windows.filter(w => mapped.has(w.refName))
  const candidates = (answered.length ? answered : windows).map(w => ({
    refName: w.refName,
    overlap: px.get(w.refName) ?? 0,
  }))
  const widest = candidates.reduce((a, b) => (b.overlap > a.overlap ? b : a))
  const incumbent = candidates.find(c => c.refName === previous?.onto)
  const onto = preferIncumbent(widest, incumbent)?.refName
  return {
    spreading: false,
    onto,
    elsewhere: windows
      .filter(w => w.refName !== onto && mapped.has(w.refName))
      .map(w => w.refName),
    coverage,
  }
}
