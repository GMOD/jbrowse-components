import { preferIncumbent } from '../syntenyHysteresis.ts'
import { followPlacedWindows } from './followAnchorWindow.ts'
import { spanBounds } from './positionViewOnSpan.ts'

import type { ResolvedSpan } from '../LinearSyntenyRPC/resolveAlignmentSpan.ts'
import type { AnchorWindow, FollowWindow } from './followAnchorWindow.ts'
import type { Region } from '@jbrowse/core/util/types'

// Above this share of the panel's px in windows cut short of their contig, the
// panel is a locus straddle rather than an overview.
const MOSTLY_PARTIAL = 0.5

// Block edges come off pixels, so a fully visible contig reports an end a hair
// short of its region's: five of eight on a `showAllRegions` panel.
const WHOLE_ENOUGH = 0.99

const MIN_COVERAGE = 0.5

// won back a little higher than lost, so a pan along the threshold does not
// flip the row between the two furthest-apart placements
const COVERAGE_BAND = 0.1

export interface SpreadDecision {
  spreading: boolean
  // the contig the row is placed on instead, when it is not spreading
  onto?: string
  // the anchor's other contigs that answered, which the header offers as
  // places to scroll onto
  elsewhere?: string[]
  coverage?: number
}

export function coversContig(w: FollowWindow, regions: Region[]) {
  const region = regions.find(r => r.refName === w.refName)
  return (
    !!region && w.end - w.start >= (region.end - region.start) * WHOLE_ENOUGH
  )
}

/**
 * The share of the anchor panel's px in windows cut short of their contig: the
 * gate on the coverage test, since an honest overview covers as little as 22%
 * of what it places, which no coverage threshold tells from a straddle.
 */
export function partialShare({
  regions,
  windows,
}: {
  regions: Region[]
  windows: AnchorWindow[]
}) {
  let partial = 0
  let total = 0
  for (const w of windows) {
    total += w.widthPx
    if (!coversContig(w, regions)) {
      partial += w.widthPx
    }
  }
  return total > 0 ? partial / total : 0
}

/**
 * The mapped bp over the bp of the interval `positionViewOnSpans` would place,
 * with spans merged per contig.
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
 * Whether this level's multi-contig answer is worth the screen it costs: a row
 * placed on two answers also shows every contig between them. Refused, the
 * level is demoted onto the widest window that answered, with the block pick's
 * hysteresis.
 */
export function decideSpread({
  stayingRegions,
  movingRegions,
  windows,
  spans,
  mapped,
  previous,
}: {
  stayingRegions: Region[]
  movingRegions: Region[]
  windows: AnchorWindow[]
  spans: ResolvedSpan[]
  /** the anchor contigs a span came back for, from `followSpreadSpans` */
  mapped: ReadonlyMap<string, string>
  previous?: SpreadDecision
}): SpreadDecision {
  // one contig answering is the rung below's case whatever else is on screen
  const [only, ...others] = mapped.keys()
  if (only !== undefined && others.length === 0) {
    return { spreading: false, onto: only, elsewhere: [] }
  }
  if (partialShare({ regions: stayingRegions, windows }) <= MOSTLY_PARTIAL) {
    return { spreading: true }
  }
  const coverage = spreadCoverage(movingRegions, spans)
  const floor =
    previous?.spreading === false ? MIN_COVERAGE + COVERAGE_BAND : MIN_COVERAGE
  if (coverage === undefined || coverage >= floor) {
    return { spreading: true, coverage }
  }
  // among the contigs that answered, so the rung below has something to place
  // from
  const answered = windows.filter(w => mapped.has(w.refName))
  const candidates = (answered.length ? answered : windows).map(w => ({
    refName: w.refName,
    overlap: w.widthPx,
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
