import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { linkedReadColorPalette } from '../../shaders/palettes.ts'
import {
  classifyPair,
  filterEntries,
  groupReadsByName,
} from '../linkedReads/compute.ts'

import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'

// Curve count is bounded by SV count; normal-pair lines moved to the GPU
// straight-line pass so this cap only protects against pathological data.
const MAX_BEZIER_ARCS = 500

// Minimum horizontal bezier handle in screen pixels so the direction is visible
// even for very tightly-spaced pairs.
const MIN_TANGENT_PX = 15

// Fraction of horizontal arc width used as the bezier handle length.
// At 0 this degenerates to a symmetric arch; larger values make the S-curve
// more pronounced for inversions and duplications.
const TANGENT_FACTOR = 0.3

// Arc peak height above the read center, in units of rowHeight.
const PEAK_ROW_FACTOR = 3

function arcIsVisible(
  sy1: number,
  sy2: number,
  peakH: number,
  isNormal: boolean,
  viewportH: number,
) {
  const arcTop = Math.min(sy1, sy2) - (isNormal ? 0 : peakH)
  const arcBottom = Math.max(sy1, sy2)
  return arcTop < viewportH && arcBottom > 0
}

function bezierPath(
  sx1: number,
  sy1: number,
  sx2: number,
  sy2: number,
  s1: number,
  p2Strand: number,
  peakH: number,
) {
  const apexY = Math.min(sy1, sy2) - peakH
  const tangentDx = Math.max(
    MIN_TANGENT_PX,
    Math.abs(sx2 - sx1) * TANGENT_FACTOR,
  )
  const cp1x = sx1 + s1 * tangentDx
  const cp2x = sx2 + p2Strand * tangentDx
  return `M ${sx1} ${sy1} C ${cp1x} ${apexY} ${cp2x} ${apexY} ${sx2} ${sy2}`
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
  rangeY: [number, number]
  viewportH: number
}

// Bezier curves for aberrant pairs, plus straight `M..L..` paths for
// cross-region normal pairs (the GPU straight-line pass cannot span regions).
// Within-region normal pairs are rendered by the GPU + Canvas2D pipelines, so
// they are intentionally absent here.
export function computePileupBezierArcs(opts: Opts): PileupArc[] {
  const {
    laidOutPileupMap,
    displayedRegions,
    bpToScreenX,
    featureHeight,
    featureSpacing,
    pileupTopOffset,
    rangeY,
    viewportH,
  } = opts

  const rowH = featureHeight + featureSpacing
  const rangeY0 = rangeY[0]
  const peakH = rowH * PEAK_ROW_FACTOR
  const readCenterDy = featureHeight / 2

  const { readsByName, hasPaired } = groupReadsByName({ laidOutPileupMap })
  const result: PileupArc[] = []

  for (const [, entries] of readsByName) {
    if (entries.length < 2) {
      continue
    }
    const filtered = filterEntries(entries, hasPaired)
    if (filtered.length < 2) {
      continue
    }
    for (let j = 0; j < filtered.length - 1; j++) {
      if (result.length >= MAX_BEZIER_ARCS) {
        return result
      }
      const e1 = filtered[j]!
      const e2 = filtered[j + 1]!
      const c = classifyPair(e1, e2, hasPaired)
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

      const sy1 =
        e1.data.readYs[e1.readIdx]! * rowH +
        pileupTopOffset -
        rangeY0 +
        readCenterDy
      const sy2 =
        e2.data.readYs[e2.readIdx]! * rowH +
        pileupTopOffset -
        rangeY0 +
        readCenterDy

      if (!arcIsVisible(sy1, sy2, peakH, c.isNormal, viewportH)) {
        continue
      }

      const d = c.isNormal
        ? `M ${sx1} ${sy1} L ${sx2} ${sy2}`
        : bezierPath(sx1, sy1, sx2, sy2, c.s1, c.p2Strand, peakH)
      const stroke = rgb255(
        linkedReadColorPalette[c.colorType] ?? linkedReadColorPalette[0]!,
      )

      result.push({
        d,
        stroke,
        id1: e1.data.readIds[e1.readIdx] ?? '',
        id2: e2.data.readIds[e2.readIdx] ?? '',
      })
    }
  }

  return result
}
