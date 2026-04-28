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
export const LINKED_READ_COLOR_SPLIT_RF = 5
export const LINKED_READ_COLOR_SPLIT_FR = 6
export const LINKED_READ_COLOR_SPLIT_SAME = 7

export interface ReadEntry {
  displayedRegionIndex: number
  readIdx: number
  data: PileupDataResult
}

export interface GroupedReads {
  readsByName: Map<string, ReadEntry[]>
  hasPaired: boolean
}

// Strand-aware genomic connection endpoint.
// For paired reads: the 3' end of each read.
// For split reads: the second alignment connects at the inverted end
// (the junction is the 5' of the supplementary segment).
export function connectionBp(
  hasPaired: boolean,
  strand: number,
  start: number,
  end: number,
  isSecond: boolean,
) {
  if (!isSecond || hasPaired) {
    return strand === -1 ? start : end
  }
  return strand === -1 ? end : start
}

// Normal LR pairs (orient 0/1) and FR split reads get a straight line;
// aberrant orientations get a bezier curve to stand out visually.
export function isNormalOrientation(
  hasPaired: boolean,
  orientNum: number,
  s1: number,
  p2Strand: number,
) {
  return hasPaired ? orientNum <= 1 : s1 === 1 && p2Strand === -1
}

export function pairedColorType(orientNum: number) {
  if (orientNum === LINKED_READ_COLOR_PAIR_LR) {
    return LINKED_READ_COLOR_PAIR_LR
  }
  if (orientNum === LINKED_READ_COLOR_PAIR_RL) {
    return LINKED_READ_COLOR_PAIR_RL
  }
  if (orientNum === LINKED_READ_COLOR_PAIR_RR) {
    return LINKED_READ_COLOR_PAIR_RR
  }
  if (orientNum === LINKED_READ_COLOR_PAIR_LL) {
    return LINKED_READ_COLOR_PAIR_LL
  }
  return LINKED_READ_COLOR_PAIR_UNKNOWN
}

export function splitColorType(p1Strand: number, p2Strand: number) {
  if (p1Strand === -1 && p2Strand === 1) {
    return LINKED_READ_COLOR_SPLIT_RF
  }
  if (p1Strand === 1 && p2Strand === -1) {
    return LINKED_READ_COLOR_SPLIT_FR
  }
  return LINKED_READ_COLOR_SPLIT_SAME
}

interface GroupOpts {
  laidOutPileupMap: ReadonlyMap<number, PileupDataResult>
}

// Group reads across all displayed regions by readName. Used by both the
// straight-line emitter and the bezier-curve emitter.
export function groupReadsByName(opts: GroupOpts): GroupedReads {
  const readsByName = new Map<string, ReadEntry[]>()
  let hasPaired = false
  for (const [idx, data] of opts.laidOutPileupMap) {
    const { readIds, readFlags, readNames } = data
    for (let i = 0; i < readIds.length; i++) {
      if (!hasPaired && readFlags[i]! & SAM_FLAG_PAIRED) {
        hasPaired = true
      }
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
  return { readsByName, hasPaired }
}

export function filterEntries(entries: ReadEntry[], hasPaired: boolean) {
  if (hasPaired) {
    const out: ReadEntry[] = []
    for (const e of entries) {
      const f = e.data.readFlags[e.readIdx]!
      if (
        !(f & SAM_FLAG_SUPPLEMENTARY) &&
        !(f & SAM_FLAG_MATE_UNMAPPED)
      ) {
        out.push(e)
      }
    }
    return out
  }
  const out: ReadEntry[] = []
  for (const e of entries) {
    if (!(e.data.readFlags[e.readIdx]! & SAM_FLAG_SECONDARY)) {
      out.push(e)
    }
  }
  return out
}

export interface ClassifiedPair {
  e1: ReadEntry
  e2: ReadEntry
  bp1: number
  bp2: number
  s1: number
  p2Strand: number
  orientNum: number
  isNormal: boolean
  colorType: number
}

export function classifyPair(
  e1: ReadEntry,
  e2: ReadEntry,
  hasPaired: boolean,
): ClassifiedPair {
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
  // p2Strand is negated for split reads because the endpoint selection
  // convention is inverted for supplementary alignments.
  const p2Strand = hasPaired ? s2 : -s2
  const orientNum = e1.data.readPairOrientations[e1.readIdx] ?? 0
  const isNormal = isNormalOrientation(hasPaired, orientNum, s1, p2Strand)
  const colorType = hasPaired
    ? pairedColorType(orientNum)
    : splitColorType(s1, p2Strand)
  return { e1, e2, bp1, bp2, s1, p2Strand, orientNum, isNormal, colorType }
}

interface LinesOpts {
  laidOutPileupMap: ReadonlyMap<number, PileupDataResult>
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
  opts: LinesOpts,
): Map<number, LinkedReadLines> {
  const { readsByName, hasPaired } = groupReadsByName(opts)

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
    const filtered = filterEntries(entries, hasPaired)
    if (filtered.length < 2) {
      continue
    }
    for (let j = 0; j < filtered.length - 1; j++) {
      const e1 = filtered[j]!
      const e2 = filtered[j + 1]!
      if (e1.displayedRegionIndex !== e2.displayedRegionIndex) {
        continue
      }
      const c = classifyPair(e1, e2, hasPaired)
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
      bucket.ys.push(
        e1.data.readYs[e1.readIdx]!,
        e2.data.readYs[e2.readIdx]!,
      )
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
