import { colorFwdStrand, colorRevStrand } from '@jbrowse/core/ui/palette'
import { CUBIC_APEX_RATIO, measureText } from '@jbrowse/core/util'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { MergedJunction } from './junctions.ts'
import type { AlignmentFill } from '@jbrowse/core/ui/palette'

// Sashimi arc geometry, shared by the on-screen `SashimiArcsOverlay` and the SVG
// export so the two cannot drift. It stays vector SVG by design: native
// per-path hover, and a pan patches one `d` per keyed path
// (agent-docs/reference/INTERACTION_PERF.md).
export interface SashimiArc {
  d: string
  strokeWidth: number
  start: number
  end: number
  refName: string
  score: number
  strand: number
  motif: number
  labelX: number
  labelY: number
  // false when the arc is too narrow on screen to fit its count text
  showLabel: boolean
}

export interface SashimiArcsBySide {
  up: SashimiArc[]
  down: SashimiArc[]
}

// Every field here moves during a gesture; the merge's inputs do not.
export interface ProjectSashimiArcsOpts {
  bpToScreenX: (refName: string, bp: number) => number | undefined
  // the box both hosts draw into, so the cull cannot drop an arc either shows
  viewWidthPx: number
  coverageHeight: number
  sashimiArcsHeight: number
  // by `junctionKey`, decided in `junctions.ts` from the loaded data so the
  // strip the layout reserved and the arcs drawn into it are one decision
  downJunctionKeys: ReadonlySet<string>
}

// A junction is tinted like the reads supporting it. The neutral is the theme's
// unpaired-read grey, resolved by each host from its own palette so the dark
// theme and a themed export both get theirs.
export function sashimiArcColor(
  strand: number,
  fill: Pick<AlignmentFill, 'pairLR'>,
) {
  return strand === 1
    ? colorFwdStrand
    : strand === -1
      ? colorRevStrand
      : fill.pairLR
}

// Owned here because `labelSpanPx` and the apex clearance both depend on them.
export const SASHIMI_LABEL_FONT_SIZE = 9
export const SASHIMI_LABEL_HALO_WIDTH = 2.5

const MIN_LABEL_SPAN_PX = 22
const LABEL_PADDING_PX = 6

// The digit term: a 4-5 digit count on deep RNA-seq overflowed its arc under a
// flat 22px threshold.
function labelSpanPx(count: number) {
  return Math.max(
    MIN_LABEL_SPAN_PX,
    measureText(count, SASHIMI_LABEL_FONT_SIZE) + LABEL_PADDING_PX,
  )
}

// Arc height follows the junction's genomic span on a fixed log scale, so it is
// zoom-invariant and independent of which other arcs are on screen.
const MIN_ARC_FRAC = 0.3
const MAX_ARC_FRAC = 0.95
const SPAN_REF_MIN_BP = 50
const SPAN_REF_MAX_BP = 100_000

// Room the count label needs past a down arc's apex. Only the down band pays
// it, because only the down band is clipped; an up arc's label draws into the
// histogram's scalebar margin. Charging the up band too took 16% off every arc
// in the default 45px coverage band to avoid a rare overlap with the axis text.
export const SASHIMI_APEX_CLEARANCE_PX =
  SASHIMI_LABEL_FONT_SIZE / 2 + SASHIMI_LABEL_HALO_WIDTH / 2

// Screen-ordered: a reversed region maps start to the larger x.
function screenSpan(x1: number, x2: number) {
  const [left, right] = x1 <= x2 ? [x1, x2] : [x2, x1]
  return { left, right, spanPx: right - left }
}

// Floored at 1px: a thinner stroke can be neither seen nor hovered.
function strokeWidthForCount(count: number) {
  return Math.max(1, Math.log(count + 1))
}

function arcHeightFraction(genomicSpan: number) {
  const logRefMin = Math.log(SPAN_REF_MIN_BP)
  const logRefRange = Math.log(SPAN_REF_MAX_BP) - logRefMin
  const norm = Math.min(
    1,
    Math.max(0, (Math.log(Math.max(1, genomicSpan)) - logRefMin) / logRefRange),
  )
  return MIN_ARC_FRAC + (MAX_ARC_FRAC - MIN_ARC_FRAC) * norm
}

// Band-local geometry per side. Both bands floor at 0: nothing floors a
// config-declared height, and a negative band flips the arcs through the
// neighbouring band instead of collapsing them flat.
function bandGeometry(
  side: keyof SashimiArcsBySide,
  heights: { effectiveHeight: number; sashimiArcsHeight: number },
) {
  return side === 'down'
    ? {
        band: Math.max(
          0,
          heights.sashimiArcsHeight - SASHIMI_APEX_CLEARANCE_PX,
        ),
        baseline: 0,
        dir: 1,
      }
    : {
        band: heights.effectiveHeight,
        baseline: heights.effectiveHeight,
        dir: -1,
      }
}

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

const byScore = (a: SashimiArc, b: SashimiArc) => a.score - b.score

/**
 * The frame-owed half: merged junctions in, screen geometry out, each side
 * ascending by score. That order is document order, so a heavy junction paints
 * over, and takes the hover from, a light one drawn near it.
 */
export function projectSashimiArcs(
  merged: Iterable<MergedJunction>,
  opts: ProjectSashimiArcsOpts,
): SashimiArcsBySide {
  const {
    bpToScreenX,
    viewWidthPx,
    coverageHeight,
    sashimiArcsHeight,
    downJunctionKeys,
  } = opts
  // Up arcs hang off the histogram's zero line, one scalebar offset above the
  // band bottom; the overlay already places the band at the histogram top, a
  // second offset down.
  const effectiveHeight = Math.max(
    0,
    coverageHeight - 2 * YSCALEBAR_LABEL_OFFSET,
  )
  const out: SashimiArcsBySide = { up: [], down: [] }
  for (const j of merged) {
    const x1 = bpToScreenX(j.refName, j.start)
    const x2 = bpToScreenX(j.refName, j.end)
    // an end inside a collapsed intron has no pixel to hang from
    if (x1 === undefined || x2 === undefined) {
      continue
    }
    const span = screenSpan(x1, x2)
    const strokeWidth = strokeWidthForCount(j.count)
    // A cull, not a filter or a cap: an arc's ink runs foot to foot in x, so
    // one whose span misses the box paints nothing, and nothing has to decide
    // which junctions matter. Blocks extend past the viewport, so these are
    // common.
    const inkPad = strokeWidth / 2
    if (span.right < -inkPad || span.left > viewWidthPx + inkPad) {
      continue
    }
    // 'up' reserves no strip, so it is the safe side for a junction the
    // layout's merge somehow never saw
    const side = downJunctionKeys.has(j.key) ? 'down' : 'up'
    const { band, baseline, dir } = bandGeometry(side, {
      effectiveHeight,
      sashimiArcsHeight,
    })
    const arcHeight = band * arcHeightFraction(Math.abs(j.end - j.start))
    out[side].push({
      ...arcCubic(span, baseline, baseline + dir * arcHeight),
      strokeWidth,
      start: j.start,
      end: j.end,
      refName: j.refName,
      score: j.count,
      strand: j.strand,
      motif: j.motif,
      showLabel: span.spanPx >= labelSpanPx(j.count),
    })
  }
  out.up.sort(byScore)
  out.down.sort(byScore)
  return out
}

/**
 * One group's per-region sashimi arrays, restricted to the regions on screen,
 * tagged with each region's refName — what `mergeJunctions` takes.
 */
export function visibleRegionJunctions(
  rpcDataMap: ReadonlyMap<number, WorkerPileupData>,
  visibleRegions: readonly {
    refName: string
    displayedRegionIndex: number
  }[],
) {
  return visibleRegions.flatMap(region => {
    const data = rpcDataMap.get(region.displayedRegionIndex)
    return data && data.sashimiX1.length > 0
      ? [{ refName: region.refName, data }]
      : []
  })
}
