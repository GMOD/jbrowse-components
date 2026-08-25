import {
  colorFwdStrand,
  colorNeutralRead,
  colorRevStrand,
} from '@jbrowse/core/ui/palette'
import { measureText } from '@jbrowse/core/util'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import { mergeJunctions } from './junctions.ts'

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { JunctionFilter, SashimiSide } from './junctions.ts'

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
  // Splice-site motif code (motif.ts), for the tooltip and the detail widget.
  motif: number
  side: SashimiSide
  // Apex of the cubic (Bezier midpoint) where the read-count label sits.
  labelX: number
  labelY: number
  // Suppressed when the arc is too narrow on screen to fit its count text.
  showLabel: boolean
}

export interface ComputeSashimiArcsOpts extends JunctionFilter {
  rpcDataMap: ReadonlyMap<number, WorkerPileupData>
  visibleRegions: {
    refName: string
    displayedRegionIndex: number
  }[]
  bpToScreenX: (refName: string, bp: number) => number | undefined
  // The view's width, which is the box both hosts draw into — the overlay's
  // `<svg width>` and, through `canvasWidth`, the export's. One number, so the
  // cull below cannot drop an arc one of them would have shown.
  viewWidthPx: number
  coverageHeight: number
  sashimiArcsHeight: number
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
      : colorNeutralRead
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
    viewWidthPx,
    coverageHeight,
    sashimiArcsHeight,
    minSashimiScore,
    hideNonCanonicalJunctions,
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
  const merged = mergeJunctions(
    visibleRegions.flatMap(region => {
      const data = rpcDataMap.get(region.displayedRegionIndex)
      return data && data.sashimiX1.length > 0
        ? [{ refName: region.refName, data }]
        : []
    }),
    { minSashimiScore, hideNonCanonicalJunctions },
  )

  // The overlay/export place each side in the matching SVG, so `d` is
  // band-local. MAX_ARC_FRAC leaves the top margin that keeps the tallest arc
  // clear of the y-scalebar label.
  const arcs: SashimiArc[] = []
  for (const j of merged.values()) {
    const x1 = bpToScreenX(j.refName, j.start)
    const x2 = bpToScreenX(j.refName, j.end)
    // A coordinate inside a collapsed intron is in no displayed region at all,
    // so it has no pixel to hang from and the whole arc is dropped rather than
    // drawn against a clamped edge that asserts a splice site not on screen.
    if (x1 === undefined || x2 === undefined) {
      continue
    }
    const span = screenSpan(x1, x2)
    const strokeWidth = strokeWidthForCount(j.count)
    // OFF-SCREEN ARCS ARE DROPPED, which is a cull and not a filter: an arc's
    // ink runs exactly foot to foot in x — `arcCubic` puts both control points
    // on the endpoints' own xs, and the count label rides the midpoint between
    // them — so one whose whole span sits outside the box paints nothing
    // wherever it is placed.
    //
    // There is a real set of them. A region is FETCHED by block, and blocks
    // extend past the viewport, so `rpcDataMap` carries junctions for sequence
    // the reader cannot see; every one of them was becoming a `<path>` (and a
    // `<text>`) that React reconciled on every pan frame. The arc band has both
    // a cull (`arcTouchesRegion`) and a cap (`CROSS_REGION_ARC_CAP`); sashimi
    // had neither, and `minSashimiScore` is a statement about evidence rather
    // than a frame budget.
    //
    // Not a cap, deliberately: a cap has to decide which junctions matter, and
    // this decides nothing — every arc it drops is one with no pixel in the box.
    // The stroke is what makes the bound exact rather than approximate, since a
    // deeply-supported junction is drawn several px wide about its own path.
    const inkPad = strokeWidth / 2
    if (span.right < -inkPad || span.left > viewWidthPx + inkPad) {
      continue
    }
    // Junctions the layout never saw can't exist (it merges the loaded regions,
    // a superset of the visible ones), but 'up' is the side that needs no
    // reserved strip, so it is also the safe answer if one ever did.
    const side: SashimiSide = downJunctionKeys.has(j.key) ? 'down' : 'up'
    const { band, baseline, dir } = bandGeometry(side, {
      effectiveHeight,
      sashimiArcsHeight,
    })
    const arcHeight = band * arcHeightFraction(Math.abs(j.end - j.start))
    arcs.push({
      ...arcCubic(span, baseline, baseline + dir * arcHeight),
      stroke: getArcColor(j.strand),
      strokeWidth,
      start: j.start,
      end: j.end,
      refName: j.refName,
      score: j.count,
      strand: j.strand,
      motif: j.motif,
      side,
      showLabel: span.spanPx >= labelSpanPx(j.count),
    })
  }

  // ASCENDING SCORE, because this array is the SVG's document order and that
  // decides two things at once.
  //
  // Paint: the last path drawn keeps the pixels it shares, so a junction merged
  // from a later region punched its hairline through every heavier arc it
  // overlapped. `mergeJunctions` returns first-seen order, which is the worker's
  // and has nothing to do with count.
  //
  // Hover: the paths carry `pointerEvents: 'stroke'`, so the topmost one under
  // the cursor takes the tooltip. Alternative 5'/3' splice sites sit a few bp
  // apart and draw as near-identical arcs, so a 1-read junction laid over a
  // 200-read one answered for it — the same defect `hitTestArcBand` had for
  // read-connection arcs, arriving here through the browser's hit test instead
  // of one of ours.
  //
  // `SashimiArcLabels` already stated this order as the reason its text is a
  // separate pass. That was true of the intent and not of the code; the labels
  // still need their own pass, but now for the reason given.
  arcs.sort((a, b) => a.score - b.score)
  return arcs
}
