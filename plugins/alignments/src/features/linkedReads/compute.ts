import {
  CONNECTION_LABELS,
  PAIR_DIRECTION_NUM,
  classifyConnection,
  isAbnormalConnection,
  readGroupConnections,
  readNameAt,
} from '@jbrowse/alignments-core'

import { LINKED_READ_SLOT_CATEGORY } from '../../shaders/palettes.ts'
import { getOrCreate } from '../../shared/util.ts'

import type { SwatchCategory } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import type { LaidOutPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { CanonicalRefName } from '../arcs/arcTypes.ts'
import type { LinkedReadLinesUploadData } from './types.ts'
import type { ConnectionKind } from '@jbrowse/alignments-core'

// Color slots for the linked-read connecting lines and bezier curves, shared by
// Canvas2D / SVG and the GPU palette uniform; the order matches
// linkedReadColorPalette in shaders/palettes.ts. The four pair slots are the
// worker's orientation codes, taken from PAIR_DIRECTION_NUM so the two
// orderings cannot be renumbered apart.
export const LINKED_READ_COLOR_PAIR_UNKNOWN = 0
export const LINKED_READ_COLOR_PAIR_LR = PAIR_DIRECTION_NUM.LR
export const LINKED_READ_COLOR_PAIR_RL = PAIR_DIRECTION_NUM.RL
export const LINKED_READ_COLOR_PAIR_RR = PAIR_DIRECTION_NUM.RR
export const LINKED_READ_COLOR_PAIR_LL = PAIR_DIRECTION_NUM.LL
// The split-read slots continue past the pair block; they have no orientation
// code of their own, so they number off its end.
export const LINKED_READ_COLOR_SPLIT_NORMAL = LINKED_READ_COLOR_PAIR_LL + 1
export const LINKED_READ_COLOR_SPLIT_INV = LINKED_READ_COLOR_PAIR_LL + 2
// A mate link whose two ends are on different chromosomes, in the slot that
// was a dead duplicate of the LR fallback, so the palette keeps its eight
// entries. Its own slot because orientation is meaningless across a
// translocation yet arrives populated and plausible: `@gmod/bam` resolves
// `selfIsLeft` from `refId < mateRefId` and hands back a real code off an
// ordering of chromosome ids.
export const LINKED_READ_COLOR_INTERCHROM = LINKED_READ_COLOR_PAIR_LL + 3

// The bezier-arc hover tooltip's and legend row's wording, shared with the
// breakpoint split view through CONNECTION_LABELS. Slot 0 takes LR's swatch, but
// calling it LR would assert an orientation nothing measured.
// `declared` is `color.labels` by bucket, as the read key names it.
// A split junction that maps back over its own read. Not a palette slot: the
// overlay alone draws it, in the color of the RL pairs that span such a
// junction (`connectorPaletteSlot`), under the arc band's name for the class.
export const LINKED_READ_COLOR_MAPS_BACK = LINKED_READ_COLOR_INTERCHROM + 1
const MAPS_BACK_LABEL = 'Split read (duplication-type)'

export function connectorPaletteSlot(colorType: number) {
  return colorType === LINKED_READ_COLOR_MAPS_BACK
    ? LINKED_READ_COLOR_PAIR_RL
    : colorType
}

export function connectionLabel(
  colorType: number,
  declared: Partial<Record<SwatchCategory, string>> = {},
) {
  if (colorType === LINKED_READ_COLOR_MAPS_BACK) {
    return MAPS_BACK_LABEL
  }
  const category = LINKED_READ_SLOT_CATEGORY[colorType]
  return category === undefined || colorType === LINKED_READ_COLOR_PAIR_UNKNOWN
    ? CONNECTION_LABELS.readPair
    : (declared[category] ?? CONNECTION_LABELS[category])
}

// No refName, unlike the arc path's entry: every comparison this path makes is
// between two on-screen entries, and the overlay resolves each end's refName
// through its own `displayedRegionIndex` at draw time. That difference is why
// the two paths build their own entries; the field ACCESSORS are shared
// (readGroupConnections).
export interface ReadEntry {
  displayedRegionIndex: number
  readIdx: number
  data: LaidOutPileupData
}

// The slot each connection kind draws in: the inverse of
// LINKED_READ_SLOT_CATEGORY, which names the swatch a slot takes.
const LINKED_READ_SLOT: Record<ConnectionKind, number> = {
  readPair: LINKED_READ_COLOR_PAIR_UNKNOWN,
  pairLR: LINKED_READ_COLOR_PAIR_LR,
  pairRL: LINKED_READ_COLOR_PAIR_RL,
  pairRR: LINKED_READ_COLOR_PAIR_RR,
  pairLL: LINKED_READ_COLOR_PAIR_LL,
  splitDeletion: LINKED_READ_COLOR_SPLIT_NORMAL,
  splitInversion: LINKED_READ_COLOR_SPLIT_INV,
  interchrom: LINKED_READ_COLOR_INTERCHROM,
}

// Group reads across all displayed regions by readName. Used by both the
// straight-line emitter and the bezier-curve emitter.
//
// The arc path has the twin of this loop over its own entry type. Sharing them
// was tried and measured back out.
//
// A nameless feature is skipped rather than bucketed under '': the PAF/synteny
// blocks LGVSyntenyDisplay pushes through this pipeline carry no QNAME, so one
// bucket held every block in view and `splitJunctions` chained them into a run
// of fabricated junctions between features that share nothing. `chainGroupingKey`
// gives the layout the same answer from the other side.
export function groupReadsByName(
  laidOutPileupMap: ReadonlyMap<number, LaidOutPileupData>,
): Map<string, ReadEntry[]> {
  const readsByName = new Map<string, ReadEntry[]>()
  for (const [idx, data] of laidOutPileupMap) {
    const { readKeys } = data
    for (let i = 0; i < readKeys.length; i++) {
      const name = readNameAt(data, i)
      if (name) {
        getOrCreate(readsByName, name, () => []).push({
          displayedRegionIndex: idx,
          readIdx: i,
          data,
        })
      }
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
  // A same-strand split whose next segment starts back upstream of where the
  // last one ended, so the read covers the stretch between twice.
  mapsBack: boolean
  colorType: number
  // A split-read junction (drives the fold-back of the second endpoint's bezier
  // handle) vs a paired mate link. Same `isSplit` the resolver assigns; carried
  // through so the overlay doesn't re-derive it.
  isSplit: boolean
}

// This path's reading of the shared classification (`classifyConnection`,
// which the breakpoint split view draws from too): the kind's palette slot,
// and whether the connection is normal enough for the straight-line pass.
export function classifyPair(
  e1: ReadEntry,
  e2: ReadEntry,
  isSplit: boolean,
): ClassifiedPair {
  const { kind, bp1, s1, bp2, s2 } = classifyConnection({ e1, e2, isSplit })
  // The rule the arc band classes a junction by (`splitJunctionColor`): the read
  // extends right from its lower foot and left from its higher one. A split's
  // first foot is a trailing edge and its second a leading one, so the read
  // extends against s1 from the first and along s2 from the second. Two feet
  // on one base are a forward jump.
  const mapsBack =
    kind === 'splitDeletion' &&
    e1.displayedRegionIndex === e2.displayedRegionIndex &&
    bp1 !== bp2 &&
    (bp1 < bp2 ? s1 === -1 : s1 === 1)
  return {
    bp1,
    bp2,
    s1,
    s2,
    isNormal: !mapsBack && !isAbnormalConnection(kind),
    mapsBack,
    colorType: mapsBack ? LINKED_READ_COLOR_MAPS_BACK : LINKED_READ_SLOT[kind],
    isSplit,
  }
}

export interface LinkedPair {
  e1: ReadEntry
  e2: ReadEntry
  c: ClassifiedPair
  // The loci this junction skips over — see `ReadConnection`. Carried on the
  // pair rather than folded into `ClassifiedPair`, which answers what the
  // connection IS; this answers what the view is missing of it.
  hiddenSegmentsBetween?: string[]
  // Every on-screen alignment of the read, the pair's own two included.
  segments: readonly ReadEntry[]
}

// Enumerate the connections across all displayed regions: group reads by name,
// then resolve each group into per-mate split junctions + the mate link
// (readGroupConnections owns filtering, read-order sorting, and paired/split
// partitioning). `resolveConnectors` walks it once for both the straight-line
// pass and the bezier overlay, so the rules that define "a linked pair" live in
// one place.
//
// `canonicalRefName` is what lets a junction report the segments it skipped
// (`hiddenSegmentsBetween`) in the view's own refName spelling. Both emitters
// pass one: the overlay dashes such a junction, and the straight-line pass
// leaves it to the overlay.
export function* iterLinkedPairs(
  laidOutPileupMap: ReadonlyMap<number, LaidOutPileupData>,
  canonicalRefName?: CanonicalRefName,
): Generator<LinkedPair> {
  for (const [, entries] of groupReadsByName(laidOutPileupMap)) {
    // Pure fast path, NOT a correctness gate — a singleton group yields no
    // connection either way (nothing to chain, and a mate link needs both sides
    // present). It's here because that is the overwhelmingly common group at
    // depth, and skipping it avoids the resolver's dedup Map and its several
    // per-group arrays. Do not grow a branch off this count: which mates are on
    // screen is the mate partition's question, and answering it from an entry
    // count is what once dropped a split read's off-screen mate arc.
    if (entries.length >= 2) {
      for (const {
        e1,
        e2,
        isSplit,
        hiddenSegmentsBetween,
      } of readGroupConnections(entries, canonicalRefName)) {
        yield {
          e1,
          e2,
          c: classifyPair(e1, e2, isSplit),
          hiddenSegmentsBetween,
          segments: entries,
        }
      }
    }
  }
}

// The pairs the GPU / Canvas2D straight-line pass draws: normal orientation,
// both ends in one displayed region, and no unfetched segment between them.
// The overlay takes every other pair (`isBezierArcPair`), since only it can
// dash a hidden-segment junction and name the loci in a hover.
export function isGpuLinkedReadLine({
  e1,
  e2,
  c,
  hiddenSegmentsBetween,
}: LinkedPair): boolean {
  return (
    c.isNormal &&
    e1.displayedRegionIndex === e2.displayedRegionIndex &&
    !hiddenSegmentsBetween?.length
  )
}

// Per-region straight-line records for the `isGpuLinkedReadLine` pairs given,
// one map entry per region holding a line, in the shape the renderers consume
// so it spreads straight onto the region's data. Positions are absolute genomic
// uint32 (worker contract); each end carries its own row because mates can sit
// on different rows when sorting is on.
export function linkedReadLinesByRegion(
  pairs: Iterable<LinkedPair>,
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

  for (const { e1, e2, c } of pairs) {
    const bucket = getOrCreate(acc, e1.displayedRegionIndex, () => ({
      positions: [],
      ys: [],
      colorTypes: [],
    }))
    bucket.positions.push(c.bp1, c.bp2)
    bucket.ys.push(e1.data.readYs[e1.readIdx]!, e2.data.readYs[e2.readIdx]!)
    bucket.colorTypes.push(c.colorType)
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
