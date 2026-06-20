import {
  bezierConnectorHandlePx,
  bezierConnectorPath,
} from '@jbrowse/core/util'

import { iterLinkedPairs } from './compute.ts'
import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { linkedReadColorPalette } from '../../LinearAlignmentsDisplay/shaders/palettes.ts'

import type { ReadEntry } from './compute.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

// The control points sit at the endpoints' own Y, so the curve stays within the
// [min, max] Y band — no apex to extend the bounds.
function arcIsVisible(sy1: number, sy2: number, viewportBottom: number) {
  return Math.min(sy1, sy2) < viewportBottom && Math.max(sy1, sy2) > 0
}

// Horizontal-tangent oval shared with BreakpointSplitView's AlignmentConnections
// (see bezierConnectorPath). Each control point sits at its endpoint's Y and is
// offset horizontally along the read's actual BAM strand (fwd → right, rev →
// left), so the curve leaves each read horizontally. For split reads
// `connectionEndpoints` puts sx1 at read1's read-trailing edge and sx2 at
// read2's read-leading edge, and the tangent still follows each segment's
// strand.
function bezierPath(
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
  s1: number,
  s2: number,
) {
  const tangentDx = bezierConnectorHandlePx(sx1, sx2)
  return bezierConnectorPath({
    x1: sx1,
    y1: sy1,
    x2: sx2,
    y2: sy2,
    dx1: s1 * tangentDx,
    dx2: s2 * tangentDx,
  })
}

export interface PileupArc {
  d: string
  stroke: string
  id1: string
  id2: string
}

interface Opts {
  laidOutPileupMap: ReadonlyMap<number, PileupDataResult>
  displayedRegions: { refName: string }[]
  bpToScreenX: (refName: string, bp: number) => number | undefined
  featureHeight: number
  featureSpacing: number
  pileupTopOffset: number
  scrollTop: number
  viewportH: number
}

// Bezier curves for aberrant pairs, plus straight `M..L..` paths for
// cross-region normal pairs. Within-region normal pairs are rendered by the
// GPU + Canvas2D pipelines and intentionally absent here.
export function computePileupBezierArcs(opts: Opts): PileupArc[] {
  const {
    laidOutPileupMap,
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

  for (const { e1, e2, c } of iterLinkedPairs(laidOutPileupMap)) {
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

    const d = c.isNormal
      ? `M ${sx1} ${sy1} L ${sx2} ${sy2}`
      : bezierPath(sx1, sy1, sx2, sy2, c.s1, c.s2)
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
