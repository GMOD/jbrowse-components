import { fillColor } from '../../shared/color.ts'
import {
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '../../shared/samFlags.ts'

import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'

// Stop generating arcs after this many to avoid flooding the DOM.
const MAX_ARCS = 500

// Minimum horizontal bezier handle in screen pixels so the direction is visible
// even for very tightly-spaced pairs.
const MIN_TANGENT_PX = 15

// Fraction of horizontal arc width used as the bezier handle length.
// At 0 this degenerates to a symmetric arch; larger values make the S-curve
// more pronounced for inversions and duplications.
const TANGENT_FACTOR = 0.3

// Arc peak height above the read center, in units of rowHeight.
const PEAK_ROW_FACTOR = 3

// Orientation code (readPairOrientations) → CSS stroke color.
// Indices 0 and 1 (unknown / normal LR) intentionally use lightgrey so normal
// pairs are de-emphasised and structural variants stand out.
const PAIRED_STROKE = [
  fillColor.color_pair_lr, // 0 unknown
  fillColor.color_pair_lr, // 1 LR — normal FR pair
  fillColor.color_pair_rl, // 2 RL — duplication
  fillColor.color_pair_rr, // 3 RR — inversion
  fillColor.color_pair_ll, // 4 LL — inversion
]

// Split-read (long read / SA tag) stroke color, keyed by effective strand
// directions at the two endpoints.  Mirrors computeArcsFromPileupData's
// unpairedOrientationColor logic so the overlay matches the arc-band colors.
function splitStroke(p1Strand: number, p2Strand: number): string {
  if (p1Strand === -1 && p2Strand === 1) {
    return fillColor.color_longread_rev_fwd // RF orientation
  }
  if (p1Strand === 1 && p2Strand === -1) {
    return fillColor.color_longread_fwd_rev // FR orientation
  }
  return fillColor.color_longread_same // same-strand (inversion-like)
}

export interface PileupArc {
  d: string
  stroke: string
  id1: string
  id2: string
}

interface Opts {
  laidOutPileupMap: ReadonlyMap<number, PileupDataResult>
  visibleRegions: { refName: string }[]
  bpToScreenX: (refName: string, bp: number) => number | undefined
  featureHeight: number
  featureSpacing: number
  pileupTopOffset: number
  rangeY: [number, number]
  viewportH: number
}

export function computePileupArcs(opts: Opts): PileupArc[] {
  const {
    laidOutPileupMap,
    visibleRegions,
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
  // Anchor arcs at the vertical center of the read rectangle.
  const readCenterDy = featureHeight / 2

  const readsByName = new Map<
    string,
    { refName: string; readIdx: number; data: PileupDataResult }[]
  >()

  let hasPaired = false
  for (const [idx, data] of laidOutPileupMap) {
    const region = visibleRegions[idx]
    if (!region) {
      continue
    }
    const { refName } = region
    for (let i = 0; i < data.readIds.length; i++) {
      if (!hasPaired && data.readFlags[i]! & SAM_FLAG_PAIRED) {
        hasPaired = true
      }
      const name = data.readNames[i]!
      let list = readsByName.get(name)
      if (!list) {
        list = []
        readsByName.set(name, list)
      }
      list.push({ refName, readIdx: i, data })
    }
  }

  const result: PileupArc[] = []

  for (const [, entries] of readsByName) {
    if (entries.length < 2) {
      continue
    }

    const filtered = hasPaired
      ? entries.filter(
          e =>
            !(e.data.readFlags[e.readIdx]! & SAM_FLAG_SUPPLEMENTARY) &&
            !(e.data.readFlags[e.readIdx]! & SAM_FLAG_MATE_UNMAPPED),
        )
      : entries.filter(
          e => !(e.data.readFlags[e.readIdx]! & SAM_FLAG_SECONDARY),
        )

    if (filtered.length < 2) {
      continue
    }

    for (let j = 0; j < filtered.length - 1; j++) {
      if (result.length >= MAX_ARCS) {
        return result
      }
      const e1 = filtered[j]!
      const e2 = filtered[j + 1]!
      const s1 = e1.data.readStrands[e1.readIdx]!
      const s2 = e2.data.readStrands[e2.readIdx]!
      const start1 = e1.data.readPositions[e1.readIdx * 2]!
      const end1 = e1.data.readPositions[e1.readIdx * 2 + 1]!
      const start2 = e2.data.readPositions[e2.readIdx * 2]!
      const end2 = e2.data.readPositions[e2.readIdx * 2 + 1]!

      // Strand-aware connecting endpoint: for paired reads, the 3' end.
      // For split reads the second alignment connects at the opposite end
      // relative to its strand (the junction is the 5' of the next segment).
      const bp1 = s1 === -1 ? start1 : end1
      const bp2 = hasPaired
        ? s2 === -1
          ? start2
          : end2
        : s2 === -1
          ? end2
          : start2

      // Effective tangent direction at p2. Negated for split reads because
      // the endpoint selection formula is inverted for supplementary alignments.
      const p2Strand = hasPaired ? s2 : -s2

      const sx1 = bpToScreenX(e1.refName, bp1)
      const sx2 = bpToScreenX(e2.refName, bp2)
      if (sx1 === undefined || sx2 === undefined) {
        continue
      }

      const yRow1 = e1.data.readYs[e1.readIdx]!
      const yRow2 = e2.data.readYs[e2.readIdx]!
      const sy1 = yRow1 * rowH + pileupTopOffset - rangeY0 + readCenterDy
      const sy2 = yRow2 * rowH + pileupTopOffset - rangeY0 + readCenterDy

      if ((sy1 < 0 && sy2 < 0) || (sy1 > viewportH && sy2 > viewportH)) {
        continue
      }

      const orientNum = e1.data.readPairOrientations[e1.readIdx] ?? 0
      // Normal LR pairs (orient 0/1) and FR split reads get a flat line;
      // aberrant orientations get a bezier curve so they stand out visually.
      const isNormal = hasPaired
        ? orientNum <= 1
        : s1 === 1 && p2Strand === -1

      let d: string
      if (isNormal) {
        d = `M ${sx1} ${sy1} L ${sx2} ${sy2}`
      } else {
        const apexY = Math.min(sy1, sy2) - peakH
        const tangentDx = Math.max(
          MIN_TANGENT_PX,
          Math.abs(sx2 - sx1) * TANGENT_FACTOR,
        )
        const cp1x = sx1 + s1 * tangentDx
        const cp2x = sx2 + p2Strand * tangentDx
        d = `M ${sx1} ${sy1} C ${cp1x} ${apexY} ${cp2x} ${apexY} ${sx2} ${sy2}`
      }

      const stroke = hasPaired
        ? (PAIRED_STROKE[orientNum] ?? PAIRED_STROKE[0]!)
        : splitStroke(s1, p2Strand)

      const id1 = e1.data.readIds[e1.readIdx] ?? ''
      const id2 = e2.data.readIds[e2.readIdx] ?? ''
      result.push({ d, stroke, id1, id2 })
    }
  }

  return result
}
