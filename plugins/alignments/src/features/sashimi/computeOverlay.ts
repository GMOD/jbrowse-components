import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'

import { colorTypeToStrand } from './compute.ts'

import type { SashimiArcsMode } from '../../LinearAlignmentsDisplay/constants.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

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

// Fraction of the band a span-scaled arc may occupy: the narrowest junction
// rises to MIN_ARC_FRAC, the widest to MAX_ARC_FRAC. Scaling arc height by span
// lets nested junctions nest visually instead of all flat-topping on one line.
const MIN_ARC_FRAC = 0.3
const MAX_ARC_FRAC = 0.95

// A junction resolved to screen space, before side-assignment / height-scaling.
interface RawArc {
  left: number
  right: number
  spanPx: number
  count: number
  score: number
  strand: number
  start: number
  end: number
  refName: string
}

// Two arcs "cross" when their spans interleave (a < c < b < d) — not nested and
// not disjoint. Nested/disjoint pairs never visually collide once heights are
// span-scaled, so only crossings need to be pulled onto opposite sides.
function crosses(a: RawArc, b: RawArc) {
  const [x, y] = a.left <= b.left ? [a, b] : [b, a]
  return y.left < x.right && x.right < y.right
}

// Greedy 2-coloring for 'auto': walk junctions left-to-right and place each on
// the side it crosses least, so interleaving junctions separate above/below the
// coverage. O(n²) is fine — sashimi arc counts are low by design.
function assignSides(raw: RawArc[]): SashimiSide[] {
  const sides = new Array<SashimiSide>(raw.length)
  const up: RawArc[] = []
  const down: RawArc[] = []
  for (const { a, i } of raw
    .map((a, i) => ({ a, i }))
    .sort((p, q) => p.a.left - q.a.left)) {
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
  const effectiveHeight = coverageHeight - YSCALEBAR_LABEL_OFFSET

  const raw: RawArc[] = []
  for (const region of visibleRegions) {
    const rpcData = rpcDataMap.get(region.displayedRegionIndex)
    if (!rpcData || rpcData.sashimiX1.length === 0) {
      continue
    }
    const { refName } = region
    const {
      sashimiX1,
      sashimiX2,
      sashimiCounts,
      sashimiColorTypes,
      sashimiScores,
    } = rpcData
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
      raw.push({
        left,
        right,
        spanPx: Math.abs(right - left),
        count,
        score: sashimiScores[i]!,
        strand: colorTypeToStrand(sashimiColorTypes[i]!),
        start: startBp,
        end: endBp,
        refName,
      })
    }
  }

  const sides: SashimiSide[] =
    mode === 'auto'
      ? assignSides(raw)
      : raw.map(() => (mode === 'down' ? 'down' : 'up'))

  // Normalize arc height across all visible junctions on a log scale so the
  // widest gets MAX_ARC_FRAC and the narrowest MIN_ARC_FRAC. Log keeps a single
  // huge intron from flattening every other arc to the floor.
  const logSpans = raw.map(a => Math.log(a.spanPx + 1))
  const minLog = Math.min(...logSpans)
  const maxLog = Math.max(...logSpans)
  const logRange = maxLog - minLog

  const arcs: SashimiArc[] = []
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i]!
    const side = sides[i]!
    const isDown = side === 'down'
    // Each side draws in its own band-local coordinates: up arcs hang off the
    // coverage-overlay band bottom and rise; down arcs hang off the strip top
    // and drop. The overlay/export place each in the matching SVG.
    const band = isDown ? sashimiArcsHeight : effectiveHeight
    const baseline = isDown ? 0 : effectiveHeight * 0.95
    const dir = isDown ? 1 : -1
    const norm = logRange > 0 ? (Math.log(a.spanPx + 1) - minLog) / logRange : 1
    const arcHeight = band * (MIN_ARC_FRAC + (MAX_ARC_FRAC - MIN_ARC_FRAC) * norm)
    const ctrl = baseline + dir * arcHeight
    arcs.push({
      d: `M ${a.left} ${baseline} C ${a.left} ${ctrl}, ${a.right} ${ctrl}, ${a.right} ${baseline}`,
      stroke: getArcColor(a.strand),
      strokeWidth: a.score,
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
