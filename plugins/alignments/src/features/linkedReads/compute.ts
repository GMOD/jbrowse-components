import { splitInversion } from '@jbrowse/alignments-core'

import {
  connectionEndpoints,
  readGroupConnections,
} from '../../shared/readGroupConnections.ts'

import type { LinkedReadLinesUploadData } from './types.ts'
import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'

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

// Human-readable connection classification for the bezier-arc hover tooltip.
// Pair-orientation wording matches CATEGORY_LEGEND (the read-fill legend) so the
// same LR/RL/RR/LL nomenclature IGV uses reads consistently across the swatch
// and the arc. Split labels are interpretive because a split-read strand flip is
// an unambiguous inversion junction (unlike library-dependent pair orientation);
// split inversion and RR pairs deliberately share the inversion blue (see
// linkedReadColorPalette) — the dashed stroke says which evidence produced it.
export function connectionLabel(colorType: number) {
  switch (colorType) {
    case LINKED_READ_COLOR_SPLIT_INV:
      return 'Split-read inversion'
    case LINKED_READ_COLOR_SPLIT_NORMAL:
      return 'Split read (deletion)'
    case LINKED_READ_COLOR_PAIR_RR:
      return 'RR - Both mates reverse strand'
    case LINKED_READ_COLOR_PAIR_RL:
      return 'RL - Mates point outward'
    case LINKED_READ_COLOR_PAIR_LL:
      return 'LL - Both mates forward strand'
    case LINKED_READ_COLOR_PAIR_LR:
      return 'LR - Normal pair orientation'
    default:
      return 'Read pair'
  }
}

export interface ReadEntry {
  displayedRegionIndex: number
  readIdx: number
  data: PileupDataResult
}

// Normal LR pairs (orient 0/1) and same-strand split reads get a straight line;
// aberrant orientations get a bezier curve to stand out visually. A split read
// is "normal" (a plain deletion) when both segments keep the same strand;
// opposite strands flag an inversion.
export function isNormalOrientation(
  hasPaired: boolean,
  orientNum: number,
  s1: number,
  s2: number,
) {
  return hasPaired ? orientNum <= 1 : s1 === s2
}

function pairedColorType(orientNum: number) {
  return orientNum >= LINKED_READ_COLOR_PAIR_LR &&
    orientNum <= LINKED_READ_COLOR_PAIR_LL
    ? orientNum
    : LINKED_READ_COLOR_PAIR_UNKNOWN
}

// Strand-flip → inversion; co-linear same-strand (both strands known) → simple
// deletion; unknown strand → the default pair color. Maps the shared
// splitInversion category to this path's GPU palette indices, matching the
// arc-path unpairedOrientationColor and the read-fill split classifier so an
// unknown-strand split doesn't claim the deletion color in just this one channel.
export function splitColorType(s1: number, s2: number) {
  return splitInversion(s1, s2) !== undefined
    ? LINKED_READ_COLOR_SPLIT_INV
    : s1 !== 0 && s2 !== 0
      ? LINKED_READ_COLOR_SPLIT_NORMAL
      : LINKED_READ_COLOR_PAIR_UNKNOWN
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

export interface ClassifiedPair {
  bp1: number
  bp2: number
  // Actual mate / second-segment strand from the BAM (+1 or -1). Use this for
  // any geometric computation (e.g. bezier tangent direction).
  s1: number
  s2: number
  isNormal: boolean
  colorType: number
  hasPaired: boolean
}

// Classify a resolved connection. `isSplit` (from readGroupConnections) selects
// the semantics: a mate link uses paired-read rules, a split junction uses
// split-read rules. This lets paired short reads, split long reads, and paired
// reads that are themselves SA-split all coexist in one view.
export function classifyPair(
  e1: ReadEntry,
  e2: ReadEntry,
  isSplit: boolean,
): ClassifiedPair {
  const hasPaired = !isSplit
  const { bp1, s1, bp2, s2 } = connectionEndpoints({ e1, e2, isSplit })
  const orientNum = e1.data.readPairOrientations[e1.readIdx] ?? 0
  const isNormal = isNormalOrientation(hasPaired, orientNum, s1, s2)
  const colorType = hasPaired
    ? pairedColorType(orientNum)
    : splitColorType(s1, s2)
  return { bp1, bp2, s1, s2, isNormal, colorType, hasPaired }
}

export interface LinkedPair {
  e1: ReadEntry
  e2: ReadEntry
  c: ClassifiedPair
}

// Enumerate the connections across all displayed regions: group reads by name,
// then resolve each group into per-mate split junctions + the mate link
// (readGroupConnections owns filtering, read-order sorting, and paired/split
// partitioning). Both the straight-line emitter (computeLinkedReadLinesByRegion)
// and the bezier-curve emitter (computePileupBezierArcs) iterate this, so the
// rules that define "a linked pair" live in one place.
export function* iterLinkedPairs(
  laidOutPileupMap: ReadonlyMap<number, PileupDataResult>,
): Generator<LinkedPair> {
  for (const [, entries] of groupReadsByName(laidOutPileupMap)) {
    if (entries.length >= 2) {
      for (const { e1, e2, isSplit } of readGroupConnections(entries)) {
        yield { e1, e2, c: classifyPair(e1, e2, isSplit) }
      }
    }
  }
}

// Build per-region straight-line records for normal-orientation pairs whose
// mates are wholly contained in a single displayedRegion. Returns one map
// entry per region that has at least one line, in the same
// `LinkedReadLinesUploadData` shape the GPU/Canvas2D renderers consume so the
// chain-layout post-pass can spread it straight onto `PileupDataResult` with no
// field renaming. Cross-region pairs are excluded — those keep flowing through
// the SVG bezier overlay's straight fallback path.
//
// Output positions are absolute genomic uint32 (worker contract); per-endpoint
// Y is needed because mates can sit on different rows when sorting is on.
export function computeLinkedReadLinesByRegion(
  laidOutPileupMap: ReadonlyMap<number, PileupDataResult>,
): Map<number, LinkedReadLinesUploadData> {
  // Collect raw records first by region, then materialize typed arrays.
  const acc = new Map<
    number,
    {
      positions: number[]
      ys: number[]
      colorTypes: number[]
    }
  >()

  for (const { e1, e2, c } of iterLinkedPairs(laidOutPileupMap)) {
    const sameRegion = e1.displayedRegionIndex === e2.displayedRegionIndex
    if (sameRegion && c.isNormal) {
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

  const out = new Map<number, LinkedReadLinesUploadData>()
  for (const [idx, bucket] of acc) {
    out.set(idx, {
      linkedReadLinePositions: Uint32Array.from(bucket.positions),
      linkedReadLineYs: Uint16Array.from(bucket.ys),
      linkedReadLineColorTypes: Uint8Array.from(bucket.colorTypes),
      numLinkedReadLines: bucket.colorTypes.length,
    })
  }
  return out
}
