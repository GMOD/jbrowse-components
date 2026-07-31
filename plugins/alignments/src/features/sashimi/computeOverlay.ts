import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'
import {
  colorFwdStrand,
  colorNostrand,
  colorRevStrand,
} from '@jbrowse/core/ui/theme'
import { measureText } from '@jbrowse/core/util'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// Sashimi placement, owned by the compute layer (the display imports it via
// constants.ts): 'up' draws every arc over the coverage band, 'down' in the
// reserved strip below it, 'auto' splits each junction to minimize crossings.
export const SASHIMI_ARCS_MODES = ['up', 'down', 'auto'] as const
export type SashimiArcsMode = (typeof SASHIMI_ARCS_MODES)[number]

// Which sub-band an arc is drawn in: 'up' overlays the coverage histogram,
// 'down' sits in the reserved strip below it. Each side's geometry is in its own
// band-local coordinates, so the overlay/export place each in the matching SVG.
export type SashimiSide = 'up' | 'down'

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
  mode: SashimiArcsMode
  minSashimiScore: number
}

// Sashimi arcs reuse the read-alignment strand colors (theme.ts) so a junction
// is tinted the same as the reads supporting it. Opaque hex (not rgba/alpha):
// the arc strokes are thin and the count label carries its own white halo, so
// they stay legible over the coverage histogram, and plain 6-digit hex
// serializes into the SVG export with the widest tool compatibility.
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

// Fraction of the band a span-scaled arc may occupy. Arc height scales with the
// junction's *genomic* span on a fixed log scale: a junction at/below
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

// A junction resolved to screen space, before side-assignment / height-scaling.
// `left`/`right` are screen-ordered (left <= right), NOT start/end-ordered: a
// reversed displayed region maps the junction's start to the larger screen x, so
// the raw projection comes back flipped. The cubic is symmetric under the swap
// (both interior controls share one y), so drawing was never affected — but
// `crosses` compares left edges to decide interleaving, and fed a flipped pair
// it read the arc as spanning the wrong interval and mis-assigned sides in
// 'auto'. Building these three fields only through `screenSpan` keeps every
// downstream consumer on screen order by construction.
interface RawArc {
  left: number
  right: number
  spanPx: number
  count: number
  strand: number
  start: number
  end: number
  refName: string
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

// The arc itself: a symmetric cubic from (left, baseline) to (right, baseline)
// with both interior controls at `ctrl`. The count label rides the curve's
// midpoint, which for that control layout is exactly 75% of the way from
// baseline to `ctrl` — derived from the same two numbers the path string uses,
// so the label cannot drift off the curve it annotates.
function arcCubic(
  span: { left: number; right: number },
  baseline: number,
  ctrl: number,
) {
  const { left, right } = span
  return {
    d: `M ${left} ${baseline} C ${left} ${ctrl}, ${right} ${ctrl}, ${right} ${baseline}`,
    labelX: (left + right) / 2,
    labelY: baseline + 0.75 * (ctrl - baseline),
  }
}

// The interleaving test's whole input: any left<=right ordered pair. RawArc
// satisfies it in screen px; the pre-layout band gate (`hasCrossingSpans`)
// passes genomic bp.
interface Span {
  left: number
  right: number
}

// Two arcs "cross" when their spans strictly interleave (a < c < b < d) — not
// nested and not disjoint. Nested/disjoint pairs never visually collide once
// heights are span-scaled, so only crossings need to be pulled onto opposite
// sides. Junctions sharing an endpoint (same donor or same acceptor, common in
// alternative splicing) are nested, not crossing, so `x.left < y.left` must be
// strict — otherwise a shared-start pair gets needlessly split across bands.
function crosses(a: Span, b: Span) {
  const [x, y] = a.left <= b.left ? [a, b] : [b, a]
  return x.left < y.left && y.left < x.right && x.right < y.right
}

// How many already-placed arcs on one side this arc would interleave with.
function countCrossings(placed: RawArc[], a: RawArc) {
  return placed.reduce((n, o) => n + (crosses(a, o) ? 1 : 0), 0)
}

// Greedy 2-coloring for 'auto': place each junction on the side it crosses
// least, so interleaving junctions separate above/below the coverage. Processed
// heaviest-first (ties broken left-to-right) so when a crossing forces a split
// the higher-count junction claims the upper band and the lighter one drops.
// O(n²) is fine — sashimi arc counts are low by design.
//
// The greedy pass visits the arcs in a different order than it reports them, so
// it keys sides by the arc object and re-reads them in input order. The lookup
// is total by construction: the loop below visits every element of `raw`.
function autoSides(raw: RawArc[]) {
  const up: RawArc[] = []
  const down: RawArc[] = []
  const sides = new Map<RawArc, SashimiSide>()
  const heaviestFirst = [...raw].sort(
    (p, q) => q.count - p.count || p.left - q.left,
  )
  for (const a of heaviestFirst) {
    const side: SashimiSide =
      countCrossings(up, a) <= countCrossings(down, a) ? 'up' : 'down'
    sides.set(a, side)
    ;(side === 'up' ? up : down).push(a)
  }
  return raw.map(arc => ({ arc, side: sides.get(arc)! }))
}

// Each junction paired with the side it draws on. 'up'/'down' force every arc
// one way — and since SashimiSide is exactly SashimiArcsMode minus 'auto', that
// branch needs no mapping table. Pairs rather than a `sides[]` parallel to
// `raw[]`, so no caller carries an index alignment it cannot see.
function resolveSides(raw: RawArc[], mode: SashimiArcsMode) {
  return mode === 'auto'
    ? autoSides(raw)
    : raw.map(arc => ({ arc, side: mode }))
}

// Exactly the condition under which `autoSides` puts at least one arc 'down',
// so the layout can reserve the below-coverage strip only when 'auto' will
// actually fill it (a score filter that removes every crossing junction lets the
// survivors reclaim that space). No crossings => every arc sees
// upCross == downCross == 0 and takes 'up'. One crossing pair (a before b in
// heaviest-first order) => either a is already 'down', or a is 'up' and b sees
// upCross >= 1, so b only stays 'up' when some earlier arc is 'down'. Either way
// the band is used.
//
// O(n²) like `autoSides`, but unlike it this runs over every junction in every
// LOADED region (not just the visible ones), so the pair walk is an index
// comparison rather than a `spans.slice(i + 1)` per element — the slices copied
// O(n²) elements on top of the O(n²) comparisons.
export function hasCrossingSpans(spans: Span[]) {
  return spans.some((a, i) => spans.some((b, j) => j > i && crosses(a, b)))
}

export function computeSashimiArcs(opts: ComputeSashimiArcsOpts): SashimiArc[] {
  const {
    rpcDataMap,
    visibleRegions,
    bpToScreenX,
    coverageHeight,
    sashimiArcsHeight,
    mode,
    minSashimiScore,
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

  // Collapsed introns split one refName into many displayedRegions, and the
  // per-region worker (rpcDataMap keyed by displayedRegionIndex) re-emits a
  // junction in EVERY region its supporting reads reach: an overlap query
  // matches a read's full reference span, which by definition covers the skip
  // gap, so an exon-skipping junction turns up in the exons it jumps over too.
  // Bucket by junction identity so a shared junction renders once instead of as
  // copies stacked on a byte-identical path `d`.
  //
  // The counts are NOT guaranteed equal, so the merge keeps the max rather than
  // the first: a region spanning the junction sees every read carrying it, but
  // one merely abutting an end sees only the reads whose alignment reaches into
  // it — a strict subset. Every region's count is a lower bound, so the largest
  // is the best available estimate.
  //
  // The key is refName:start:end WITHOUT the strand. Geometry derives purely
  // from start/end, so two copies that disagreed on the dominant strand drew the
  // identical path twice — exactly the per-strand duplication `compute.ts`
  // collapses inside one region, reintroduced across regions. The heavier copy
  // therefore wins the tint as well as the count.
  const rawByJunction = new Map<string, RawArc>()
  for (const region of visibleRegions) {
    const rpcData = rpcDataMap.get(region.displayedRegionIndex)
    if (!rpcData || rpcData.sashimiX1.length === 0) {
      continue
    }
    const { refName } = region
    const { sashimiX1, sashimiX2, sashimiCounts, sashimiStrands } = rpcData
    const numSashimiArcs = sashimiX1.length

    for (let i = 0; i < numSashimiArcs; i++) {
      const count = sashimiCounts[i]!
      const startBp = sashimiX1[i]!
      const endBp = sashimiX2[i]!
      const left = bpToScreenX(refName, startBp)
      const right = bpToScreenX(refName, endBp)
      if (
        left === undefined ||
        right === undefined ||
        count < minSashimiScore
      ) {
        continue
      }
      const junctionKey = `${refName}:${startBp}:${endBp}`
      const existing = rawByJunction.get(junctionKey)
      if (existing) {
        if (count > existing.count) {
          existing.count = count
          existing.strand = sashimiStrands[i]!
        }
      } else {
        rawByJunction.set(junctionKey, {
          ...screenSpan(left, right),
          count,
          strand: sashimiStrands[i]!,
          start: startBp,
          end: endBp,
          refName,
        })
      }
    }
  }
  const raw = [...rawByJunction.values()]

  // The overlay/export place each side in the matching SVG, so `d` is
  // band-local. MAX_ARC_FRAC leaves the top margin that keeps the tallest arc
  // clear of the y-scalebar label.
  return resolveSides(raw, mode).map(({ arc: a, side }) => {
    const { band, baseline, dir } = bandGeometry(side, {
      effectiveHeight,
      sashimiArcsHeight,
    })
    const arcHeight = band * arcHeightFraction(Math.abs(a.end - a.start))
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
