import {
  bezierConnectorHandlePx,
  bezierConnectorPath,
} from '@jbrowse/core/util'

import { iterLinkedPairs } from './compute.ts'
import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { linkedReadColorPalette } from '../../LinearAlignmentsDisplay/shaders/palettes.ts'

import type { LinkedPair, ReadEntry } from './compute.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// Cull by endpoint Y. A same-row connection is bowed up by a small fixed apex
// (see bezierConnector), so a curve whose endpoints sit just off-screen can peek
// in; the apex is tiny relative to the band, so testing the endpoints is enough.
function arcIsVisible(sy1: number, sy2: number, viewportBottom: number) {
  return Math.min(sy1, sy2) < viewportBottom && Math.max(sy1, sy2) > 0
}

export interface PileupArc {
  d: string
  stroke: string
  id1: string
  id2: string
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
  viewportH: number
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
    viewportH,
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

  for (const { e1, e2, c } of pairs) {
    const sameRegion = e1.displayedRegionIndex === e2.displayedRegionIndex
    // GPU + Canvas2D pipelines own normal-orientation within-region lines.
    if (c.isNormal && sameRegion) {
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

    if (!arcIsVisible(sy1, sy2, pileupTopOffset + viewportH)) {
      continue
    }

    // Normal within-region pairs are drawn upstream; aberrant/cross-region pairs
    // get the shared connector curve. Endpoint 2 is a split junction's 5' leading
    // edge (folds back) for a split read, or the mate's 3' edge for a pair. The
    // proportional handle scales with horizontal separation (single-view pileup).
    const d = c.isNormal
      ? `M ${sx1} ${sy1} L ${sx2} ${sy2}`
      : bezierConnectorPath({
          x1: sx1,
          y1: sy1,
          x2: sx2,
          y2: sy2,
          s1: c.s1,
          s2: c.s2,
          leadingEnd2: !c.hasPaired,
          reversed1: !!r1.reversed,
          reversed2: !!r2.reversed,
          handlePx: bezierConnectorHandlePx(sx1, sx2),
        })
    const stroke = rgb255(linkedReadColorPalette[c.colorType % paletteLen]!)

    result.push({
      d,
      stroke,
      id1: e1.data.readIds[e1.readIdx]!,
      id2: e2.data.readIds[e2.readIdx]!,
    })
  }

  return result
}
