import {
  BEZIER_CONNECTOR_MAX_REACH_PX,
  bezierConnectorPath,
} from '@jbrowse/core/util'

import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { linkedReadColorPalette } from '../../LinearAlignmentsDisplay/shaders/palettes.ts'
import { connectionLabel, iterLinkedPairs } from './compute.ts'

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
  // Connection classification for the hover tooltip. Split-read inversion gets
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

// Legend swatches for the connection types actually drawn as bezier/line arcs,
// built from the same palette and labels the curves use (linkedReadColorPalette
// + connectionLabel) so the on-screen key can never disagree with what's drawn.
// `colorTypes` is the set of LINKED_READ_COLOR_* present in view; sorted so the
// legend order is stable as reads stream in.
export function bezierConnectionLegendItems(
  colorTypes: Iterable<number>,
): LegendItem[] {
  const paletteLen = linkedReadColorPalette.length
  return [...colorTypes]
    .sort((a, b) => a - b)
    .map(colorType => ({
      color: rgb255(linkedReadColorPalette[colorType % paletteLen]!),
      label: connectionLabel(colorType),
    }))
}

// Enumerate the linked pairs of a laid-out region map: the scroll- and
// pan-invariant half of the overlay. Only the read grouping + connection
// resolution live here, so a model getter can memoize it (recompute on relayout
// only) while the per-frame screen projection stays in `computePileupBezierArcs`
// — the name→reads Map is no longer rebuilt on every scroll frame.
export function enumerateBezierPairs(
  laidOutPileupMap: ReadonlyMap<number, PileupDataResult>,
): LinkedPair[] {
  return [...iterLinkedPairs(laidOutPileupMap)]
}

interface Opts {
  pairs: LinkedPair[]
  displayedRegions: { refName: string; reversed?: boolean }[]
  bpToScreenX: (refName: string, bp: number) => number | undefined
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
  const paletteLen = linkedReadColorPalette.length
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
    const sx1 = bpToScreenX(r1.refName, c.bp1)
    const sx2 = bpToScreenX(r2.refName, c.bp2)
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
    const stroke = rgb255(linkedReadColorPalette[c.colorType % paletteLen]!)

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
