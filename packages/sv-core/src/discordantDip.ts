import { BEZIER_CONNECTOR_MAX_REACH_PX } from '@jbrowse/core/util'

// How deep a discordant connector dips below the reads it joins, for the two
// renderers that draw one (the pileup's bezier overlay and BreakpointSplitView's
// AlignmentConnections). Shared so the mark means the same thing in both.
//
// Keying on BASE PAIRS is what makes the depth say something: keyed on the
// endpoints' pixel separation, as it was, the only channel the mark has left
// restated the x-axis — one 20 kb event drew 55 px deep in a 20 kb view and
// 7.5 px deep in a 400 kb view. The log lerp below is sashimi's
// `arcHeightFraction` shape on an SV-scale window, not that one's 50 bp - 100 kb.
//
// `bandPx` scales it, so a deep pileup spends more of its room on the same
// event, and has to be a LAYOUT quantity — a pileup section's `pileupHeight`, a
// split-view panel's height — not a scroll-dependent one, or the depth moves as
// the reader scrolls.
//
// `roomBelowPx` is what keeps the ink inside that band: the dip starts at the
// lower read's row, not the band's top, so a 900 kb event in a 60 px band asked
// for 56 px from every row and the clip cut the apex off all but the top one.
// Capping rather than scaling keeps the depth purely event-keyed wherever the
// room is there to spend.
const MIN_DIP_FRAC = 0.3
const MAX_DIP_FRAC = 0.95
const DIP_REF_MIN_BP = 1_000
const DIP_REF_MAX_BP = 1_000_000

function dipFraction(spanBp: number | undefined) {
  // No span to measure — an interchromosomal pair, or ends in two assemblies —
  // takes the deepest dip: a translocation is the largest rearrangement there
  // is, and interchrom is already its own class in these renderers.
  if (spanBp === undefined) {
    return MAX_DIP_FRAC
  }
  const lo = Math.log(DIP_REF_MIN_BP)
  const norm = Math.min(
    1,
    Math.max(
      0,
      (Math.log(Math.max(1, spanBp)) - lo) / (Math.log(DIP_REF_MAX_BP) - lo),
    ),
  )
  return MIN_DIP_FRAC + (MAX_DIP_FRAC - MIN_DIP_FRAC) * norm
}

/**
 * Apex depth in px for a discordant connector covering `spanBp`, drawn under a
 * band `bandPx` tall with `roomBelowPx` left beneath the lower of its two reads.
 * Never exceeds that room. Pass no span for a connection whose ends share no
 * coordinate system, which gives the deepest dip the room allows.
 */
export function discordantDipPx({
  bandPx,
  roomBelowPx,
  spanBp,
}: {
  bandPx: number
  roomBelowPx: number
  spanBp?: number
}) {
  // The band, not the depth, is what the ceiling clamps: clamping the depth
  // would bottom every event past the ceiling out at one identical depth in a
  // deep pileup, which is the spaghetti a size-keyed depth exists to avoid.
  const band = Math.min(Math.max(0, bandPx), BEZIER_CONNECTOR_MAX_REACH_PX)
  return Math.min(band * dipFraction(spanBp), Math.max(0, roomBelowPx))
}
