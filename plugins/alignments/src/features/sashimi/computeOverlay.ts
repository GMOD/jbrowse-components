import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'

import { colorTypeToStrand } from './compute.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// Sashimi placement, owned by the compute layer (the display imports it via
// constants.ts): 'up' draws every arc over the coverage band, 'down' in the
// reserved strip below it, 'auto' splits each junction to minimize crossings.
export type SashimiArcsMode = 'up' | 'down' | 'auto'

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

const FWD_ARC_COLOR = 'rgba(255,170,170,0.7)'
const REV_ARC_COLOR = 'rgba(160,160,255,0.7)'
const UNKNOWN_ARC_COLOR = 'rgba(200,200,200,0.7)'

function getArcColor(strand: number) {
  return strand === 1
    ? FWD_ARC_COLOR
    : strand === -1
      ? REV_ARC_COLOR
      : UNKNOWN_ARC_COLOR
}

// Screen-px span below which the count label can't fit and is suppressed.
const MIN_LABEL_SPAN_PX = 22

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

// Stroke width scales with the log of supporting-read count (so a junction with
// 10x the reads isn't drawn 10x as thick). Floored at 1px because a sub-pixel
// stroke is both invisible and impossible to hover/click for its tooltip.
function strokeWidthForCount(count: number) {
  return Math.max(1, Math.log(count + 1))
}

// Two arcs "cross" when their spans interleave (a < c < b < d) — not nested and
// not disjoint. Nested/disjoint pairs never visually collide once heights are
// span-scaled, so only crossings need to be pulled onto opposite sides.
function crosses(a: RawArc, b: RawArc) {
  const [x, y] = a.left <= b.left ? [a, b] : [b, a]
  return y.left < x.right && x.right < y.right
}

// Greedy 2-coloring for 'auto': place each junction on the side it crosses
// least, so interleaving junctions separate above/below the coverage. Processed
// heaviest-first (ties broken left-to-right) so when a crossing forces a split
// the higher-count junction claims the upper band and the lighter one drops.
// O(n²) is fine — sashimi arc counts are low by design.
function assignSides(raw: RawArc[]): SashimiSide[] {
  const sides = new Array<SashimiSide>(raw.length)
  const up: RawArc[] = []
  const down: RawArc[] = []
  const heaviestFirst = raw
    .map((a, i) => ({ a, i }))
    .sort((p, q) => q.a.count - p.a.count || p.a.left - q.a.left)
  for (const { a, i } of heaviestFirst) {
    const upCross = up.filter(o => crosses(a, o)).length
    const downCross = down.filter(o => crosses(a, o)).length
    if (upCross <= downCross) {
      sides[i] = 'up'
      up.push(a)
    } else {
      sides[i] = 'down'
      down.push(a)
    }
  }
  return sides
}

export function computeSashimiArcs(opts: ComputeSashimiArcsOpts) {
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
  const effectiveHeight = coverageHeight - 2 * YSCALEBAR_LABEL_OFFSET

  // Collapsed introns split one refName into many displayedRegions, and the
  // per-region worker (rpcDataMap keyed by displayedRegionIndex) re-emits a
  // junction spanning two of them in each region's data: a read with the skip
  // gap overlaps both exons, so both regions' fetches return it. The fetch is
  // uncapped (the pileup maxRows cap is a separate main-thread layout concern
  // that never touches the worker's gap/coverage scan), so the two copies carry
  // identical counts. Bucket by junction identity so a shared junction renders
  // once instead of as arcs with a colliding refName:start:end:strand React key;
  // max is a deterministic tiebreak.
  const rawByJunction = new Map<string, RawArc>()
  for (const region of visibleRegions) {
    const rpcData = rpcDataMap.get(region.displayedRegionIndex)
    if (!rpcData || rpcData.sashimiX1.length === 0) {
      continue
    }
    const { refName } = region
    const { sashimiX1, sashimiX2, sashimiCounts, sashimiColorTypes } = rpcData
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
      const strand = colorTypeToStrand(sashimiColorTypes[i]!)
      const junctionKey = `${refName}:${startBp}:${endBp}:${strand}`
      const existing = rawByJunction.get(junctionKey)
      if (existing) {
        existing.count = Math.max(existing.count, count)
      } else {
        rawByJunction.set(junctionKey, {
          left,
          right,
          spanPx: Math.abs(right - left),
          count,
          strand,
          start: startBp,
          end: endBp,
          refName,
        })
      }
    }
  }
  const raw = [...rawByJunction.values()]

  const sides: SashimiSide[] =
    mode === 'auto'
      ? assignSides(raw)
      : raw.map(() => (mode === 'down' ? 'down' : 'up'))

  const logRefMin = Math.log(SPAN_REF_MIN_BP)
  const logRefRange = Math.log(SPAN_REF_MAX_BP) - logRefMin

  const arcs: SashimiArc[] = []
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i]!
    const side = sides[i]!
    const isDown = side === 'down'
    // Each side draws in its own band-local coordinates: up arcs hang off the
    // coverage histogram baseline and rise; down arcs hang off the strip top and
    // drop. The overlay/export place each in the matching SVG. MAX_ARC_FRAC
    // leaves the top margin so the tallest arc clears the y-scalebar label.
    const band = isDown ? sashimiArcsHeight : effectiveHeight
    const baseline = isDown ? 0 : effectiveHeight
    const dir = isDown ? 1 : -1
    const genomicSpan = Math.max(1, Math.abs(a.end - a.start))
    const norm = Math.min(
      1,
      Math.max(0, (Math.log(genomicSpan) - logRefMin) / logRefRange),
    )
    const arcHeight = band * (MIN_ARC_FRAC + (MAX_ARC_FRAC - MIN_ARC_FRAC) * norm)
    const ctrl = baseline + dir * arcHeight
    arcs.push({
      d: `M ${a.left} ${baseline} C ${a.left} ${ctrl}, ${a.right} ${ctrl}, ${a.right} ${baseline}`,
      stroke: getArcColor(a.strand),
      strokeWidth: strokeWidthForCount(a.count),
      start: a.start,
      end: a.end,
      refName: a.refName,
      score: a.count,
      strand: a.strand,
      side,
      labelX: (a.left + a.right) / 2,
      // Cubic midpoint with both interior controls at `ctrl`: baseline + 0.75·Δ.
      labelY: baseline + dir * arcHeight * 0.75,
      showLabel: a.spanPx >= MIN_LABEL_SPAN_PX,
    })
  }
  return arcs
}
