import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import {
  colorFwdStrand,
  colorNostrand,
  colorRevStrand,
} from '@jbrowse/core/ui/palette'
import { measureText } from '@jbrowse/core/util'

import { mergeJunctions } from './junctions.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { SashimiSide } from './junctions.ts'

// Single source of truth for sashimi arc geometry, color, and stroke width.
// Both the on-screen `SashimiArcsOverlay` (which adds hover/click handlers)
// and the SVG export (which serializes static <path>s) consume this output.
//
// Sashimi stays rendered as vector SVG by design — arc counts are low, vector
// performance is fine, and SVG paths give native hover/tooltip behavior.
// Keeping the geometry computation shared prevents the on-screen and export
// paths from drifting (e.g. cubic vs quadratic Bezier, different palettes).
export interface SashimiArc {
  d: string
  stroke: string
  strokeWidth: number
  start: number
  end: number
  refName: string
  score: number
  strand: number
  side: SashimiSide
  // Apex of the cubic (Bezier midpoint) where the read-count label sits.
  labelX: number
  labelY: number
  // Suppressed when the arc is too narrow on screen to fit its count text.
  showLabel: boolean
}

export interface ComputeSashimiArcsOpts {
  rpcDataMap: ReadonlyMap<number, PileupDataResult>
  visibleRegions: {
    refName: string
    displayedRegionIndex: number
  }[]
  bpToScreenX: (refName: string, bp: number) => number | undefined
  coverageHeight: number
  sashimiArcsHeight: number
  minSashimiScore: number
  // Which junctions draw in the strip below coverage, by `junctionKey`. Decided
  // once per group in `junctions.ts` from the loaded data, so the strip the
  // layout reserved and the arcs drawn into it are the same decision — see that
  // module's header for why this isn't recomputed here in screen space.
  downJunctionKeys: ReadonlySet<string>
}

// Sashimi arcs reuse the read-alignment strand colors (theme.ts) so a junction
// is tinted the same as the reads supporting it. Opaque hex (not rgba/alpha):
// the arc strokes are thin and the count label carries its own halo, so they
// stay legible over the coverage histogram, and plain 6-digit hex serializes
// into the SVG export with the widest tool compatibility.
function getArcColor(strand: number) {
  return strand === 1
    ? colorFwdStrand
    : strand === -1
      ? colorRevStrand
      : colorNostrand
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
// stroke lands beyond the top of an 'up' arc and beyond the bottom of a 'down'
// one. Both directions run into something. The down band is clipped to
// `sashimiArcsHeight` — it must not paint over the pileup below it — so at
// MAX_ARC_FRAC of the raw 40px default the digits' lower half, and a
// deeply-covered junction's own stroke, were shaved off by that clip. The up
// band overlays the coverage histogram and isn't clipped, but the same margin is
// what keeps a full-height arc's label off the y-scalebar's top label, which the
// bare 5% MAX_ARC_FRAC left (0.05 * 90 = 4.5px, against a label needing 5.75).
//
// Taken off the band BEFORE the fraction scales it, so MIN/MAX_ARC_FRAC keep
// meaning "of the room the arc actually has" rather than of a height whose last
// few pixels aren't drawable.
export const SASHIMI_APEX_CLEARANCE_PX =
  SASHIMI_LABEL_FONT_SIZE / 2 + SASHIMI_LABEL_HALO_WIDTH / 2

// A junction resolved to screen space, before height-scaling. `left`/`right`
// are screen-ordered (left <= right), NOT start/end-ordered: a reversed
// displayed region maps the junction's start to the larger screen x, so the raw
// projection comes back flipped. Building all three fields only through
// `screenSpan` keeps every downstream consumer on screen order by construction.
interface RawArc {
  left: number
  right: number
  spanPx: number
  count: number
  strand: number
  start: number
  end: number
  refName: string
  key: string
}

// The one place a projected (start, end) pair becomes screen order. Returning
// all three fields together is what makes `left <= right` and
// `spanPx === right - left` true by construction rather than by three
// separately-written Math.min/max/abs calls agreeing.
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
function arcHeightFraction(genomicSpan: number) {
  const logRefMin = Math.log(SPAN_REF_MIN_BP)
  const logRefRange = Math.log(SPAN_REF_MAX_BP) - logRefMin
  const norm = Math.min(
    1,
    Math.max(0, (Math.log(Math.max(1, genomicSpan)) - logRefMin) / logRefRange),
  )
  return MIN_ARC_FRAC + (MAX_ARC_FRAC - MIN_ARC_FRAC) * norm
}

// Where one side draws, in its own band-local coordinates: up arcs hang off the
// coverage histogram's zero baseline and rise, down arcs hang off the strip's
// top edge and drop. One function rather than three parallel `isDown ?`
// ternaries, which had to agree on the same predicate to stay coherent.
function bandGeometry(
  side: SashimiSide,
  heights: { effectiveHeight: number; sashimiArcsHeight: number },
) {
  return side === 'down'
    ? { band: heights.sashimiArcsHeight, baseline: 0, dir: 1 }
    : {
        band: heights.effectiveHeight,
        baseline: heights.effectiveHeight,
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

export function computeSashimiArcs(opts: ComputeSashimiArcsOpts): SashimiArc[] {
  const {
    rpcDataMap,
    visibleRegions,
    bpToScreenX,
    coverageHeight,
    sashimiArcsHeight,
    minSashimiScore,
    downJunctionKeys,
  } = opts
  // Up arcs anchor to the coverage histogram's own zero-coverage baseline. The
  // histogram reserves YSCALEBAR_LABEL_OFFSET at BOTH its top and bottom (see
  // coverageDownsampling yTop/yBottom), and the overlay already shifts the band
  // SVG down to the histogram top, so the drawable height down to that baseline
  // is coverageHeight - 2*offset. (Subtracting the offset only once anchored the
  // feet at the coverage *band* bottom, one offset below the histogram baseline.)
  //
  // Floored at 0: the 20px drag floor does not bind a config-declared
  // `coverageHeight` (see clampBandHeight), and a band under 2*offset made this
  // negative, which flipped `dir * arcHeight` and curved every 'up' arc downward
  // through the pileup instead of collapsing it flat.
  const effectiveHeight = Math.max(
    0,
    coverageHeight - 2 * YSCALEBAR_LABEL_OFFSET,
  )

  // `mergeJunctions` collapses the copies the per-region worker emits of one
  // junction (see junctions.ts) — the same merge, on the same keys, the layout's
  // side assignment ran on. Only the visible regions contribute: a junction that
  // just scrolled off has no business drawing at the edge it left behind.
  const raw: RawArc[] = []
  const merged = mergeJunctions(
    visibleRegions.flatMap(region => {
      const data = rpcDataMap.get(region.displayedRegionIndex)
      return data && data.sashimiX1.length > 0
        ? [{ refName: region.refName, data }]
        : []
    }),
    minSashimiScore,
  )
  for (const j of merged.values()) {
    const left = bpToScreenX(j.refName, j.start)
    const right = bpToScreenX(j.refName, j.end)
    // A coordinate inside a collapsed intron is in no displayed region at all,
    // so it has no pixel to hang from and the whole arc is dropped rather than
    // drawn against a clamped edge that asserts a splice site not on screen.
    if (left === undefined || right === undefined) {
      continue
    }
    raw.push({ ...screenSpan(left, right), ...j })
  }

  // The overlay/export place each side in the matching SVG, so `d` is
  // band-local. MAX_ARC_FRAC leaves the top margin that keeps the tallest arc
  // clear of the y-scalebar label.
  return raw.map(a => {
    // Junctions the layout never saw can't exist (it merges the loaded regions,
    // a superset of the visible ones), but 'up' is the side that needs no
    // reserved strip, so it is also the safe answer if one ever did.
    const side: SashimiSide = downJunctionKeys.has(a.key) ? 'down' : 'up'
    const { band, baseline, dir } = bandGeometry(side, {
      effectiveHeight,
      sashimiArcsHeight,
    })
    // Clearance comes off the band first — see SASHIMI_APEX_CLEARANCE_PX. A band
    // shorter than the clearance flattens to a zero-height arc rather than
    // inverting through the neighbouring band.
    const arcHeight =
      Math.max(0, band - SASHIMI_APEX_CLEARANCE_PX) *
      arcHeightFraction(Math.abs(a.end - a.start))
    return {
      ...arcCubic(a, baseline, baseline + dir * arcHeight),
      stroke: getArcColor(a.strand),
      strokeWidth: strokeWidthForCount(a.count),
      start: a.start,
      end: a.end,
      refName: a.refName,
      score: a.count,
      strand: a.strand,
      side,
      showLabel: a.spanPx >= labelSpanPx(a.count),
    }
  })
}
