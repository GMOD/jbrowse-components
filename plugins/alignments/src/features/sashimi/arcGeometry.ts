import { measureText } from '@jbrowse/core/util'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import type { SashimiSide } from './junctions.ts'

// The band-local geometry every arc drawn into the sashimi strips shares, and
// the ONE place it is computed. Two producers feed those strips and they must
// draw the same shape for the same numbers:
//
//   - `computeOverlay.ts` — splice junctions, from the coverage pipeline's
//     `skip` gaps, one refName per arc;
//   - `splitJunctions.ts` — split-read junctions, from the reads' own SA
//     segments, whose two ends can sit on different chromosomes.
//
// Before the split source existed this all lived inside `computeOverlay.ts`,
// where it read as the splice computation's private arithmetic. It never was:
// the constants below encode what the BAND can hold (a clipped strip, a label's
// clearance, a stroke's meaning), which is a property of where an arc is drawn
// and not of what evidence produced it.
export interface SashimiArc {
  d: string
  stroke: string
  strokeWidth: number
  start: number
  end: number
  refName: string
  // The refName `end` is on. Equal to `refName` for a splice junction and for a
  // same-chromosome split junction; different only across a fusion or
  // translocation, which only the split-read source can produce. Always
  // populated so no consumer has to spell the "same chromosome" default —
  // `refName !== endRefName` is then the whole test for "this arc crosses
  // chromosomes", which is what suppresses a meaningless length in the tooltip.
  endRefName: string
  score: number
  strand: number
  side: SashimiSide
  // What the arc claims, as the tooltip and detail widget head it: 'Intron/Skip'
  // for a splice junction, the connection's own name (`connectionLabel` — the
  // same wording its colour carries in the legend) for a split one. Carried on
  // the arc rather than switched on at the tooltip, because the two sources also
  // disagree about WHICH of several names applies and only the producer knows.
  title: string
  // Apex of the cubic (Bezier midpoint) where the read-count label sits.
  labelX: number
  labelY: number
  // Suppressed when the arc is too narrow on screen to fit its count text.
  showLabel: boolean
}

// Type size of the arc's count label. Owned here rather than by
// `SashimiArcLabels` (which imports it) because `labelSpanPx` below has to know
// how wide the text renders in order to suppress it — a font size the component
// picked on its own would silently desync the two.
export const SASHIMI_LABEL_FONT_SIZE = 9

// Width of the halo stroke painted behind the label text, owned here for the
// same reason as the font size: it widens the label's box in BOTH axes, and the
// apex clearance below has to reserve room for it vertically.
export const SASHIMI_LABEL_HALO_WIDTH = 2.5

// Screen-px span below which the count label can't fit and is suppressed.
const MIN_LABEL_SPAN_PX = 22

// Breathing room left around the text.
const LABEL_PADDING_PX = 6

// Screen-px the count text actually needs. `measureText` is the shared glyph-
// width estimate (a table for one font, so approximate — but it beats a
// hand-rolled per-digit constant, and it tracks SASHIMI_LABEL_FONT_SIZE instead
// of restating it). Floored at MIN_LABEL_SPAN_PX so short counts keep the
// conservative span they always had; the digit term only ever suppresses *more*
// — a 4-5 digit count on deep RNA-seq overflowed its arc when the threshold was
// a flat 22px regardless of how wide the text was.
function labelSpanPx(count: number) {
  return Math.max(
    MIN_LABEL_SPAN_PX,
    measureText(count, SASHIMI_LABEL_FONT_SIZE) + LABEL_PADDING_PX,
  )
}

// Fraction of the band a span-scaled arc RISES — i.e. where its apex lands, not
// where its Bezier control points go (see `arcCubic`). Arc height scales with
// the junction's *genomic* span on a fixed log scale: a junction at/below
// SPAN_REF_MIN_BP rises to MIN_ARC_FRAC, at/above SPAN_REF_MAX_BP to
// MAX_ARC_FRAC. Genomic span is zoom-invariant and per-junction, so an arc's
// height stays put while zooming and doesn't depend on which other arcs are on
// screen. (A visible-set-relative min/max normalization made arcs jump taller
// and shorter as junctions scrolled in and out of view during a zoom.) Nested
// junctions still nest: a smaller span draws a shorter arc.
const MIN_ARC_FRAC = 0.3
const MAX_ARC_FRAC = 0.95
const SPAN_REF_MIN_BP = 50
const SPAN_REF_MAX_BP = 100_000

// Vertical room an apex needs PAST the curve: the count label is centered on it
// (`arcCubic` puts labelY at the apex), so half the glyph box plus half the halo
// stroke lands beyond the arc's own extreme — below a 'down' arc, above an 'up'
// one.
//
// Only the DOWN band pays it, because only the down band is clipped: it renders
// at `sashimiArcsHeight` with overflow hidden so it can't paint over the pileup
// underneath, and at MAX_ARC_FRAC of the raw 40px default the digits' lower
// half, and a deeply-covered junction's own stroke, were shaved off by that
// clip. The up band overlays the coverage histogram with overflow visible, so
// nothing there is ever cut — its label draws into the scalebar margin the
// histogram already reserves. Charging it the same clearance was measurably the
// wrong trade: the default 45px coverage band leaves 35px of drawable height, so
// it bought a rare left-edge label/axis-text overlap for 16% off the height of
// every arc in the common case.
//
// Taken off the band BEFORE the fraction scales it, so MIN/MAX_ARC_FRAC keep
// meaning "of the room the arc actually has" rather than of a height whose last
// few pixels aren't drawable.
export const SASHIMI_APEX_CLEARANCE_PX =
  SASHIMI_LABEL_FONT_SIZE / 2 + SASHIMI_LABEL_HALO_WIDTH / 2

// The one place a projected (start, end) pair becomes screen order. `left` and
// `right` are screen-ordered (left <= right), NOT start/end-ordered: a reversed
// displayed region maps the junction's start to the larger screen x, so the raw
// projection comes back flipped. Returning all three fields together is what
// makes `left <= right` and `spanPx === right - left` true by construction
// rather than by three separately-written Math.min/max/abs calls agreeing —
// and going through it is what keeps every consumer below on screen order.
function screenSpan(x1: number, x2: number) {
  const [left, right] = x1 <= x2 ? [x1, x2] : [x2, x1]
  return { left, right, spanPx: right - left }
}

// Stroke width scales with the log of supporting-read count (so a junction with
// 10x the reads isn't drawn 10x as thick). Floored at 1px because a sub-pixel
// stroke is both invisible and impossible to hover/click for its tooltip.
function strokeWidthForCount(count: number) {
  return Math.max(1, Math.log(count + 1))
}

// Fraction of its band this junction's arc rises, from its genomic span on the
// fixed log scale above. Self-contained (the log reference points don't leak
// into the caller as loop-hoisted locals) and clamped to
// [MIN_ARC_FRAC, MAX_ARC_FRAC] for any span, including the degenerate
// zero-length one.
//
// `undefined` is the interchromosomal answer, and it resolves to MAX_ARC_FRAC
// rather than to a fallback span: a junction between two chromosomes has no
// genomic span at all (subtracting two coordinates on different number lines is
// not a distance), and the largest event on screen is the honest height for it.
function arcHeightFraction(genomicSpan: number | undefined) {
  if (genomicSpan === undefined) {
    return MAX_ARC_FRAC
  }
  const logRefMin = Math.log(SPAN_REF_MIN_BP)
  const logRefRange = Math.log(SPAN_REF_MAX_BP) - logRefMin
  const norm = Math.min(
    1,
    Math.max(0, (Math.log(Math.max(1, genomicSpan)) - logRefMin) / logRefRange),
  )
  return MIN_ARC_FRAC + (MAX_ARC_FRAC - MIN_ARC_FRAC) * norm
}

// The heights the two sub-bands are cut from, as the display holds them.
export interface SashimiBandHeights {
  coverageHeight: number
  sashimiArcsHeight: number
}

// The drawable height of the 'up' band: up arcs anchor to the coverage
// histogram's own zero-coverage baseline. The histogram reserves
// YSCALEBAR_LABEL_OFFSET at BOTH its top and bottom (see coverageDownsampling
// yTop/yBottom), and the overlay already shifts the band SVG down to the
// histogram top, so the drawable height down to that baseline is
// coverageHeight - 2*offset. (Subtracting the offset only once anchored the feet
// at the coverage *band* bottom, one offset below the histogram baseline.)
//
// Floored at 0: the 20px drag floor does not bind a config-declared
// `coverageHeight` (see clampBandHeight), and a band under 2*offset made this
// negative, which flipped `dir * arcHeight` and curved every 'up' arc downward
// through the pileup instead of collapsing it flat.
function upBandHeight(coverageHeight: number) {
  return Math.max(0, coverageHeight - 2 * YSCALEBAR_LABEL_OFFSET)
}

// Where one side draws, in its own band-local coordinates: up arcs hang off the
// coverage histogram's zero baseline and rise, down arcs hang off the strip's
// top edge and drop. One function rather than three parallel `isDown ?`
// ternaries, which had to agree on the same predicate to stay coherent.
function bandGeometry(side: SashimiSide, heights: SashimiBandHeights) {
  const up = upBandHeight(heights.coverageHeight)
  return side === 'down'
    ? {
        // Clipped, so the label's room comes out of the band — see
        // SASHIMI_APEX_CLEARANCE_PX. Floored at 0: nothing floors a
        // config-declared `sashimiArcsHeight`, and a band under the clearance
        // went negative, flipping `dir * arcHeight` and curving every down arc
        // up through the coverage histogram instead of collapsing it flat.
        band: Math.max(
          0,
          heights.sashimiArcsHeight - SASHIMI_APEX_CLEARANCE_PX,
        ),
        baseline: 0,
        dir: 1,
      }
    : {
        // Unclipped, so it spends its whole band on the arc and lets the label
        // draw into the histogram's scalebar margin.
        band: up,
        baseline: up,
        dir: -1,
      }
}

// A symmetric cubic's extreme sits at t=0.5, which for two interior controls
// sharing one y is 3/4 of the way from the baseline to that control. So a
// control placed AT the requested height only ever drew an arc 3/4 as tall, and
// MIN/MAX_ARC_FRAC of 0.3/0.95 produced apexes at 0.225/0.7125 of the band —
// the top 29% of a `sashimiArcsHeight` the user had dragged was unreachable, and
// the nested-junction heights they discriminate were squeezed into 3/4 of the
// range. Both the path and the label derive from this one constant, so the arc
// reaches exactly the height it was asked for and the constants mean what they
// say.
const CUBIC_APEX_RATIO = 0.75

// The arc itself: a symmetric cubic from (left, baseline) to (right, baseline),
// rising to `apexY`. The count label rides the curve's midpoint, which IS the
// apex — derived from the same number the path string is built from, so the
// label cannot drift off the curve it annotates.
function arcCubic(
  span: { left: number; right: number },
  baseline: number,
  apexY: number,
) {
  const { left, right } = span
  const ctrl = baseline + (apexY - baseline) / CUBIC_APEX_RATIO
  return {
    d: `M ${left} ${baseline} C ${left} ${ctrl}, ${right} ${ctrl}, ${right} ${baseline}`,
    labelX: (left + right) / 2,
    labelY: apexY,
  }
}

// Everything about an arc that follows from where it is drawn and how many
// reads back it — the half both producers share. What is left to a producer is
// only the arc's IDENTITY (its loci, its tint, what it claims), which is
// exactly the half the two sources genuinely disagree about.
export type SashimiArcGeometry = Pick<
  SashimiArc,
  'd' | 'labelX' | 'labelY' | 'strokeWidth' | 'showLabel' | 'side'
>

export function sashimiArcGeometry({
  x1,
  x2,
  genomicSpan,
  count,
  side,
  heights,
}: {
  // Screen x of each end, in either order — `screenSpan` normalizes.
  x1: number
  x2: number
  // Drives the arc's height. `undefined` for an interchromosomal junction,
  // which has none — see `arcHeightFraction`.
  genomicSpan: number | undefined
  count: number
  side: SashimiSide
  heights: SashimiBandHeights
}): SashimiArcGeometry {
  const span = screenSpan(x1, x2)
  const { band, baseline, dir } = bandGeometry(side, heights)
  const arcHeight = band * arcHeightFraction(genomicSpan)
  return {
    ...arcCubic(span, baseline, baseline + dir * arcHeight),
    strokeWidth: strokeWidthForCount(count),
    showLabel: span.spanPx >= labelSpanPx(count),
    side,
  }
}

// ASCENDING SCORE, because an arc array is its SVG's document order and that
// decides two things at once.
//
// Paint: the last path drawn keeps the pixels it shares, so a junction merged
// from a later region punched its hairline through every heavier arc it
// overlapped. Neither producer emits in count order — `mergeJunctions` returns
// first-seen order, which is the worker's, and the split source's is the reads'.
//
// Hover: the paths carry `pointerEvents: 'stroke'`, so the topmost one under
// the cursor takes the tooltip. Alternative 5'/3' splice sites sit a few bp
// apart and draw as near-identical arcs, so a 1-read junction laid over a
// 200-read one answered for it — the same defect `hitTestArcs` had for
// read-connection arcs, arriving here through the browser's hit test instead
// of one of ours.
//
// `SashimiArcLabels` already stated this order as the reason its text is a
// separate pass. That was true of the intent and not of the code; the labels
// still need their own pass, but now for the reason given.
//
// Shared by both producers AND applied again where their outputs are
// concatenated: two independently-sorted arrays joined end to end are not a
// sorted array, and the band draws them as one.
export function sortArcsByScore(arcs: SashimiArc[]) {
  arcs.sort((a, b) => a.score - b.score)
  return arcs
}
