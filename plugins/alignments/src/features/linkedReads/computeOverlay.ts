import {
  BEZIER_CONNECTOR_MAX_REACH_PX,
  bezierConnectorPath,
} from '@jbrowse/core/util'

import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { linkedReadColorPalette } from '../../shaders/palettes.ts'
// The palette-index rule, generated from alignmentsUniforms.slang (adr-051).
// Canvas2D/SVG spelled it `colorType % palette.length`, which agrees with the
// shader's clamp on every slot in use and resolves an out-of-range one to a
// different real color instead of the last slot.
import { linkedReadColorSlot } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import { connectionLabel, connectionMark, iterLinkedPairs } from './compute.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { LinkedPair, ReadEntry } from './compute.ts'
import type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

// Cull by endpoint Y. The endpoints alone don't bound the curve — every curve
// this overlay draws is discordant, so it dips below them (see bezierConnector)
// — so pad by the shaping's reach. Without this, a connector whose reads have
// both scrolled just past an edge takes its visible body with it. The pad is
// applied to both edges though the curve only reaches downward, which is merely
// over-inclusive: it keeps a few culled arcs, never drops a visible one.
function arcIsVisible(sy1: number, sy2: number, viewportBottom: number) {
  const reach = BEZIER_CONNECTOR_MAX_REACH_PX
  return (
    Math.min(sy1, sy2) - reach < viewportBottom &&
    Math.max(sy1, sy2) + reach > 0
  )
}

export interface PileupArc {
  d: string
  stroke: string
  id1: string
  id2: string
  // Connection classification for the hover tooltip. An inverted split gets
  // its own color (colorSplitReadInversion), distinct from the RR-pair blue, so
  // the two are tellable apart at a glance; the tooltip names which evidence
  // produced the arc rather than overloading a second dimension onto the stroke.
  label: string
}

// Stable React key / selection identity for a bezier arc, shared by the live
// overlay and the SVG export so the two can't key differently (mirrors
// sashimiArcKey).
export function bezierArcKey(arc: Pick<PileupArc, 'id1' | 'id2'>) {
  return `${arc.id1}:${arc.id2}`
}

// A linked pair becomes an overlay arc unless it's a normal-orientation pair
// wholly within one region — those straight connectors are drawn by the GPU /
// Canvas2D pipeline, not here. The single gate shared by the arc emitter
// (computePileupBezierArcs) and the legend (bezierConnectionColorTypes), so the
// key can never list a connection color the overlay didn't draw.
export function isBezierArcPair({ e1, e2, c }: LinkedPair): boolean {
  return !(c.isNormal && e1.displayedRegionIndex === e2.displayedRegionIndex)
}

// The two ends sit in different displayed regions, so no per-region pass can
// join them: each block clips to its own bp range and projects the far end off
// its edge. This overlay is the only one that resolves each end through its own
// region index, which is what makes it the fallback in `crossRegion` scope.
export function isCrossRegionPair({ e1, e2 }: LinkedPair): boolean {
  return e1.displayedRegionIndex !== e2.displayedRegionIndex
}

/**
 * Which connections this overlay is responsible for.
 *
 * - `all` — the user ticked "Use curved connectors", so it draws every
 *   connection the GPU line pass doesn't own (`isBezierArcPair`).
 * - `crossRegion` — chain mode with that box unticked. Chain layout puts a
 *   chain's alignments on ONE row across displayed regions (`mergeChains`) but
 *   its connecting-line pass is per region and gated on a per-worker-call
 *   `chainHasMultiple`, so a chain holding one alignment in each of two regions
 *   gets no line from either and the mode silently drops the link it exists to
 *   show. Everything inside a single region is already drawn by that pass, so
 *   this scope adds only the pairs that straddle a boundary.
 * - `none` — no overlay.
 */
export type BezierArcScope = 'all' | 'crossRegion' | 'none'

// Legend swatches for the connection types actually drawn as bezier/line arcs,
// built from the same palette, labels and straight-vs-curved rule the overlay
// itself uses (linkedReadColorPalette + connectionLabel + connectionMark) so the
// on-screen key can never disagree with what's drawn — including the glyph, now
// that a row can be drawn as the connector it names rather than as a square.
// `colorTypes` is the set of LINKED_READ_COLOR_* present in view; sorted so the
// legend order is stable as reads stream in.
export function bezierConnectionLegendItems(
  colorTypes: Iterable<number>,
): LegendItem[] {
  return [...colorTypes]
    .sort((a, b) => a - b)
    .map(colorType => ({
      color: rgb255(linkedReadColorPalette[linkedReadColorSlot(colorType)]!),
      label: connectionLabel(colorType),
      mark: connectionMark(colorType),
    }))
}

// Enumerate the linked pairs of a laid-out region map: the scroll- and
// pan-invariant half of the overlay. Only the read grouping + connection
// resolution live here, so a model getter can memoize it (recompute on relayout
// only) while the per-frame screen projection stays in `computePileupBezierArcs`
// — the name→reads Map is no longer rebuilt on every scroll frame.
//
// The `crossRegion` short-circuit is what keeps that scope free where it can buy
// nothing: a pair needs two regions to straddle, so a section holding one is
// answered without the O(reads) grouping at all. That is the single-region view,
// i.e. almost every view — which matters because unlike `all`, this scope is not
// something the user opted into.
export function enumerateBezierPairs(
  laidOutPileupMap: ReadonlyMap<number, PileupDataResult>,
  scope: BezierArcScope = 'all',
): LinkedPair[] {
  if (
    scope === 'none' ||
    (scope === 'crossRegion' && laidOutPileupMap.size < 2)
  ) {
    return []
  }
  const pairs = [...iterLinkedPairs(laidOutPileupMap)]
  return scope === 'crossRegion' ? pairs.filter(isCrossRegionPair) : pairs
}

interface Opts {
  pairs: LinkedPair[]
  displayedRegions: { refName: string; reversed?: boolean }[]
  bpToScreenX: (
    refName: string,
    bp: number,
    displayedRegionIndex?: number,
  ) => number | undefined
  featureHeight: number
  featureSpacing: number
  pileupTopOffset: number
  scrollTop: number
  // Screen-y of this section's band bottom — the visibility cull's lower edge.
  viewportBottom: number
}

// Bezier curves for aberrant pairs, plus straight `M..L..` paths for
// cross-region normal pairs. Within-region normal pairs are rendered by the
// GPU + Canvas2D pipelines and intentionally absent here. Projects the
// precomputed `pairs` (see `enumerateBezierPairs`) to screen space; this is the
// only scroll/pan-dependent half.
export function computePileupBezierArcs(opts: Opts): PileupArc[] {
  const {
    pairs,
    displayedRegions,
    bpToScreenX,
    featureHeight,
    featureSpacing,
    pileupTopOffset,
    scrollTop,
    viewportBottom,
  } = opts

  const rowH = featureHeight + featureSpacing
  const readCenterDy = featureHeight / 2
  const readScreenY = (e: ReadEntry) =>
    e.data.readYs[e.readIdx]! * rowH +
    pileupTopOffset -
    scrollTop +
    readCenterDy

  const result: PileupArc[] = []

  for (const pair of pairs) {
    const { e1, e2, c } = pair
    // GPU + Canvas2D pipelines own normal-orientation within-region lines.
    if (!isBezierArcPair(pair)) {
      continue
    }

    const r1 = displayedRegions[e1.displayedRegionIndex]
    const r2 = displayedRegions[e2.displayedRegionIndex]
    if (!r1 || !r2) {
      continue
    }
    // Region index, not just refName: the two ends of a pair can sit in two
    // different displayed regions that share a refName, and resolving by name
    // alone would draw both ends in the first of them (a zero-length arc).
    const sx1 = bpToScreenX(r1.refName, c.bp1, e1.displayedRegionIndex)
    const sx2 = bpToScreenX(r2.refName, c.bp2, e2.displayedRegionIndex)
    if (sx1 === undefined || sx2 === undefined) {
      continue
    }

    const sy1 = readScreenY(e1)
    const sy2 = readScreenY(e2)

    if (!arcIsVisible(sy1, sy2, viewportBottom)) {
      continue
    }

    // Normal-orientation pairs draw as a plain line (the within-region ones
    // never reach here — the GPU / Canvas2D pipeline owns those). Everything
    // curving here is therefore discordant, so it dips, matching
    // BreakpointSplitView: a line is normal, a curve below the reads is not.
    // Endpoint 2 is a split junction's 5' leading edge (folds back) for a split
    // read, or the mate's 3' edge for a pair.
    const d = c.isNormal
      ? `M ${sx1} ${sy1} L ${sx2} ${sy2}`
      : bezierConnectorPath({
          x1: sx1,
          y1: sy1,
          x2: sx2,
          y2: sy2,
          s1: c.s1,
          s2: c.s2,
          leadingEnd2: c.isSplit,
          reversed1: !!r1.reversed,
          reversed2: !!r2.reversed,
          dip: true,
        })
    const stroke = rgb255(
      linkedReadColorPalette[linkedReadColorSlot(c.colorType)]!,
    )

    result.push({
      d,
      stroke,
      label: connectionLabel(c.colorType),
      id1: e1.data.readIds[e1.readIdx]!,
      id2: e2.data.readIds[e2.readIdx]!,
    })
  }

  return result
}
