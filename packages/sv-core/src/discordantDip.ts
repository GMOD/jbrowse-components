import { BEZIER_CONNECTOR_MAX_REACH_PX } from '@jbrowse/core/util'

// How deep a discordant connector dips below the reads it joins, for the two
// renderers that draw one (the pileup's bezier overlay and BreakpointSplitView's
// AlignmentConnections). Shared so the mark means the same thing in both.
//
// The depth is `band * f(spanBp)`. Keying on BASE PAIRS is what makes it say
// something: keyed on the endpoints' pixel separation, as it was, the only
// channel the mark has left restated the x-axis — one 20 kb event drew 55 px
// deep in a 20 kb view and 7.5 px deep in a 400 kb view. `f` is the log lerp
// sashimi's `arcHeightFraction` uses, on an SV-scale window rather than that
// one's 50 bp - 100 kb, and a second copy of it rather than a shared call.
//
// Scaling by the BAND is what keeps the ink: each pileup section clips at its
// band bottom and the split view bleeds past its panel, so a fixed 110 px dip
// under a six-read pileup fell off the bottom and read as a breakend tick. The
// band a caller passes has to be a layout quantity — a pileup section's
// `pileupHeight`, a split-view panel's height — and not a scroll-dependent one,
// or the depth moves as the reader scrolls.
//
// Residual: the dip starts at the read's row while the band is measured from
// the band's top, so any read below that top overshoots the clip by its own
// offset — a 900 kb event in a 60 px band asks for 56 px from every row. That
// was true of the pixel rule too.
//
// Capping the dip at the room left below the lower read was tried and measured
// worse. It makes the ink fit, but on cancer_sv/derivative_inserts — 28
// molecules of one junction in one band, the figure a reviewer asked to be
// legible — every row that had to give room up flattens onto the band floor and
// the curves pile there as a solid stripe. Clipped, the same curves simply leave
// the band and the ones that remain stay readable. Shoot that figure before
// trying it again.
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
 * band `bandPx` tall. Pass no span for a connection whose ends share no
 * coordinate system, which gives that band's deepest dip.
 */
export function discordantDipPx(bandPx: number, spanBp?: number) {
  // The band, not the depth, is what the ceiling clamps: clamping the depth
  // would bottom every event past the ceiling out at one identical depth in a
  // deep pileup, which is the spaghetti a size-keyed depth exists to avoid.
  const band = Math.min(Math.max(0, bandPx), BEZIER_CONNECTOR_MAX_REACH_PX)
  return band * dipFraction(spanBp)
}
