import { iterLinkedPairs } from './compute.ts'
import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { linkedReadColorPalette } from '../../LinearAlignmentsDisplay/shaders/palettes.ts'

import type { ReadEntry } from './compute.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

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
  arcsDown: boolean,
  viewportH: number,
) {
  const minY = Math.min(sy1, sy2)
  const maxY = Math.max(sy1, sy2)
  const extra = isNormal ? 0 : peakH
  const arcTop = arcsDown ? minY : minY - extra
  const arcBottom = arcsDown ? maxY + extra : maxY
  return arcTop < viewportH && arcBottom > 0
}

interface BezierOpts {
  sx1: number
  sy1: number
  sx2: number
  sy2: number
  s1: number
  s2: number
  peakH: number
  arcsDown: boolean
}

// Tangent control points leave each endpoint in the read's 5'→3' direction,
// so a fwd read's curve heads right and a rev read's curve heads left. Use
// the *actual* strand here (not the classifier-negated one): for split reads
// `connectionBp` puts sx1 at read1's right edge and sx2 at read2's left edge,
// and the tangent direction must still match the strand to produce a
// symmetric curve over the junction.
function bezierPath({
  sx1,
  sy1,
  sx2,
  sy2,
  s1,
  s2,
  peakH,
  arcsDown,
}: BezierOpts) {
  const apexY = arcsDown
    ? Math.max(sy1, sy2) + peakH
    : Math.min(sy1, sy2) - peakH
  const tangentDx = Math.max(
    MIN_TANGENT_PX,
    Math.abs(sx2 - sx1) * TANGENT_FACTOR,
  )
  const cp1x = sx1 + s1 * tangentDx
  const cp2x = sx2 + s2 * tangentDx
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
  pairedArcsDown: boolean
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
    pairedArcsDown,
  } = opts

  const [rangeY0] = rangeY
  const rowH = featureHeight + featureSpacing
  const peakH = rowH * PEAK_ROW_FACTOR
  const readCenterDy = featureHeight / 2
  const paletteLen = linkedReadColorPalette.length
  const readScreenY = (e: ReadEntry) =>
    e.data.readYs[e.readIdx]! * rowH + pileupTopOffset - rangeY0 + readCenterDy

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

    if (!arcIsVisible(sy1, sy2, peakH, c.isNormal, pairedArcsDown, viewportH)) {
      continue
    }

    const d = c.isNormal
      ? `M ${sx1} ${sy1} L ${sx2} ${sy2}`
      : bezierPath({
          sx1,
          sy1,
          sx2,
          sy2,
          s1: c.s1,
          s2: c.s2,
          peakH,
          arcsDown: pairedArcsDown,
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
