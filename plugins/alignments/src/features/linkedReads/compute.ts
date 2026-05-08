import {
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '../../shared/samFlags.ts'

import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'

// Color type indices for linked-read connecting lines + bezier curves.
// Shared by main-thread (Canvas2D / SVG) and the GPU palette uniform.
// Order is fixed to match LinkedReadLinePalette in shaders/palettes.ts.
export const LINKED_READ_COLOR_PAIR_UNKNOWN = 0
export const LINKED_READ_COLOR_PAIR_LR = 1
export const LINKED_READ_COLOR_PAIR_RL = 2
export const LINKED_READ_COLOR_PAIR_RR = 3
export const LINKED_READ_COLOR_PAIR_LL = 4
export const LINKED_READ_COLOR_SPLIT_NORMAL = 5
export const LINKED_READ_COLOR_SPLIT_INV = 6

export interface ReadEntry {
  displayedRegionIndex: number
  readIdx: number
  data: PileupDataResult
}

// Genomic connection endpoint for a linked-read line.
// For paired reads: the 3' end of each read (strand-dependent).
// For split reads: always the inner junction edge (end for e1, start for e2),
// regardless of strand — the gap is between the right edge of the left
// alignment and the left edge of the right alignment on the reference.
export function connectionBp(
  hasPaired: boolean,
  strand: number,
  start: number,
  end: number,
  isSecond: boolean,
) {
  if (!hasPaired) {
    return isSecond ? start : end
  }
  return strand === -1 ? start : end
}

// Normal LR pairs (orient 0/1) and same-strand split reads get a straight line;
// aberrant orientations get a bezier curve to stand out visually.
// For split reads, p2Strand = -s2, so s1 === -p2Strand means both segments
// are on the same strand (simple deletion whether forward or reverse).
export function isNormalOrientation(
  hasPaired: boolean,
  orientNum: number,
  s1: number,
  p2Strand: number,
) {
  return hasPaired ? orientNum <= 1 : s1 === -p2Strand
}

export function pairedColorType(orientNum: number) {
  return orientNum >= LINKED_READ_COLOR_PAIR_LR &&
    orientNum <= LINKED_READ_COLOR_PAIR_LL
    ? orientNum
    : LINKED_READ_COLOR_PAIR_UNKNOWN
}

// Same actual strand (p1Strand === -p2Strand, since p2Strand = -s2) → simple
// deletion. Different actual strands → inversion.
export function splitColorType(p1Strand: number, p2Strand: number) {
  return p1Strand === -p2Strand
    ? LINKED_READ_COLOR_SPLIT_NORMAL
    : LINKED_READ_COLOR_SPLIT_INV
}

// Group reads across all displayed regions by readName. Used by both the
// straight-line emitter and the bezier-curve emitter.
export function groupReadsByName(
  laidOutPileupMap: ReadonlyMap<number, PileupDataResult>,
): Map<string, ReadEntry[]> {
  const readsByName = new Map<string, ReadEntry[]>()
  for (const [idx, data] of laidOutPileupMap) {
    const { readIds, readNames } = data
    for (let i = 0; i < readIds.length; i++) {
      const name = readNames[i]!
      let list = readsByName.get(name)
      if (!list) {
        list = []
        readsByName.set(name, list)
      }
      list.push({
        displayedRegionIndex: idx,
        readIdx: i,
        data,
      })
    }
  }
  return readsByName
}

// Filter entries per-read rather than per-dataset so paired short reads and
// split long reads can coexist in the same view:
//   - Always exclude secondary alignments.
//   - For paired reads: also exclude supplementary and unmapped-mate entries
//     (chimeric/unmapped short reads that would create spurious connections).
//   - For non-paired (long-read) entries: supplementary alignments are kept —
//     they are the connection targets.
export function filterEntries(entries: ReadEntry[]) {
  return entries.filter(e => {
    const f = e.data.readFlags[e.readIdx]!
    if (f & SAM_FLAG_SECONDARY) {
      return false
    }
    if (f & SAM_FLAG_PAIRED) {
      if (f & SAM_FLAG_SUPPLEMENTARY) {
        return false
      }
      if (f & SAM_FLAG_MATE_UNMAPPED) {
        return false
      }
    }
    return true
  })
}

export interface ClassifiedPair {
  bp1: number
  bp2: number
  s1: number
  p2Strand: number
  isNormal: boolean
  colorType: number
  hasPaired: boolean
}

// Classify a pair of read entries, determining per-pair whether to use
// paired-read or split-read semantics based on the SAM flags of each entry.
// This allows paired short reads and split long reads to coexist in the same
// view without a global hasPaired flag that would suppress one or the other.
export function classifyPair(e1: ReadEntry, e2: ReadEntry): ClassifiedPair {
  const f1 = e1.data.readFlags[e1.readIdx]!
  const f2 = e2.data.readFlags[e2.readIdx]!
  const hasPaired = !!(f1 & SAM_FLAG_PAIRED) && !!(f2 & SAM_FLAG_PAIRED)
  const s1 = e1.data.readStrands[e1.readIdx]!
  const s2 = e2.data.readStrands[e2.readIdx]!
  const bp1 = connectionBp(
    hasPaired,
    s1,
    e1.data.readPositions[e1.readIdx * 2]!,
    e1.data.readPositions[e1.readIdx * 2 + 1]!,
    false,
  )
  const bp2 = connectionBp(
    hasPaired,
    s2,
    e2.data.readPositions[e2.readIdx * 2]!,
    e2.data.readPositions[e2.readIdx * 2 + 1]!,
    true,
  )
  // p2Strand is negated for split reads so that s1 === -p2Strand detects
  // same-strand pairs (simple deletions) in isNormalOrientation.
  const p2Strand = hasPaired ? s2 : -s2
  const orientNum = e1.data.readPairOrientations[e1.readIdx] ?? 0
  const isNormal = isNormalOrientation(hasPaired, orientNum, s1, p2Strand)
  const colorType = hasPaired
    ? pairedColorType(orientNum)
    : splitColorType(s1, p2Strand)
  return { bp1, bp2, s1, p2Strand, isNormal, colorType, hasPaired }
}

export interface LinkedReadLines {
  positions: Uint32Array
  ys: Uint16Array
  colorTypes: Uint8Array
  numLines: number
}

// Build per-region straight-line records for normal-orientation pairs whose
// mates are wholly contained in a single displayedRegion. Returns one map
// entry per region that has at least one line. Cross-region pairs are
// excluded — those keep flowing through the SVG bezier overlay's straight
// fallback path.
//
// Output positions are absolute genomic uint32 (worker contract); per-endpoint
// Y is needed because mates can sit on different rows when sorting is on.
export function computeLinkedReadLinesByRegion(
  laidOutPileupMap: ReadonlyMap<number, PileupDataResult>,
): Map<number, LinkedReadLines> {
  const readsByName = groupReadsByName(laidOutPileupMap)

  // Collect raw records first by region, then materialize typed arrays.
  const acc = new Map<
    number,
    {
      positions: number[]
      ys: number[]
      colorTypes: number[]
    }
  >()

  for (const [, entries] of readsByName) {
    if (entries.length < 2) {
      continue
    }
    const filtered = filterEntries(entries)
    if (filtered.length < 2) {
      continue
    }
    for (let j = 0; j < filtered.length - 1; j++) {
      const e1 = filtered[j]!
      const e2 = filtered[j + 1]!
      if (e1.displayedRegionIndex !== e2.displayedRegionIndex) {
        continue
      }
      const c = classifyPair(e1, e2)
      if (!c.isNormal) {
        continue
      }
      const idx = e1.displayedRegionIndex
      let bucket = acc.get(idx)
      if (!bucket) {
        bucket = { positions: [], ys: [], colorTypes: [] }
        acc.set(idx, bucket)
      }
      bucket.positions.push(c.bp1, c.bp2)
      bucket.ys.push(e1.data.readYs[e1.readIdx]!, e2.data.readYs[e2.readIdx]!)
      bucket.colorTypes.push(c.colorType)
    }
  }

  const out = new Map<number, LinkedReadLines>()
  for (const [idx, bucket] of acc) {
    const numLines = bucket.colorTypes.length
    out.set(idx, {
      positions: Uint32Array.from(bucket.positions),
      ys: Uint16Array.from(bucket.ys),
      colorTypes: Uint8Array.from(bucket.colorTypes),
      numLines,
    })
  }
  return out
}
