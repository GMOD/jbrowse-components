import { readNameAt, splitJunctionKind } from '@jbrowse/alignments-core'
import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SECONDARY,
  readLeadingBp,
  readTrailingBp,
} from '@jbrowse/cigar-utils'
import { adapterRefName } from '@jbrowse/core/util'

import { arcSlotCategory } from '../../shaders/palettes.ts'
import { splitJunctionSlot } from '../arcs/arcColors.ts'
import { isArcSplitCategory } from '../arcs/arcSplitCategory.ts'
import { splitClassCode } from './junctionClass.ts'

import type { FeatureData } from '../../shared/webglRpcTypes.ts'
import type { ArcSplitCategory } from '../arcs/arcSplitCategory.ts'
import type { ReadNames } from '@jbrowse/alignments-core'
import type { AdapterRefName } from '@jbrowse/core/util'

const MINUS = 45
const ZERO = 48
const NINE = 57
const CLIP_OPS = new Set(['S', 'H'].map(c => c.charCodeAt(0)))
const REF_OPS = new Set(['M', 'D', 'N', '=', 'X'].map(c => c.charCodeAt(0)))
const READ_OPS = new Set(['M', 'I', '=', 'X'].map(c => c.charCodeAt(0)))

// NaN unless `s[from, to)` is a non-empty run of digits.
function digitsAt(s: string, from: number, to: number) {
  if (to <= from) {
    return Number.NaN
  }
  let n = 0
  for (let i = from; i < to; i++) {
    const code = s.charCodeAt(i)
    if (code < ZERO || code > NINE) {
      return Number.NaN
    }
    n = n * 10 + code - ZERO
  }
  return n
}

/**
 * Called once per join; `predecessorClip` is the read-order predecessor's
 * clip at the start of the read for the join into this segment, -1 for the
 * join out of it.
 */
type Visit = (
  start: number,
  end: number,
  split: ArcSplitCategory,
  predecessorClip: number,
) => void

/** One piece of a split read: its span, strand and place along the read. */
export interface SplitPiece {
  start: number
  end: number
  strand: number
  clip: number
  alignedBases: number
}

/**
 * The junction a read makes leaving piece `a` by its read-trailing edge and
 * entering the next piece in read order, `b`, by its read-leading edge,
 * classed as the read arcs class it (`splitJunctionSlot`): undefined when a
 * strand is unknown.
 */
export function splitJoin(a: SplitPiece, b: SplitPiece) {
  const bp1 = readTrailingBp(a.strand, a.start, a.end)
  const bp2 = readLeadingBp(b.strand, b.start, b.end)
  const category = arcSlotCategory(
    splitJunctionSlot(
      a.strand,
      bp1,
      b.strand,
      bp2,
      b.clip - (a.clip + a.alignedBases),
    ),
  )
  return splitJunctionKind(a.strand, b.strand) === undefined ||
    !isArcSplitCategory(category)
    ? undefined
    : { bp1, bp2, category }
}

function visitJoin(
  a: SplitPiece,
  b: SplitPiece,
  predecessorClip: number,
  visit: Visit,
) {
  const join = splitJoin(a, b)
  if (join) {
    visit(
      Math.min(join.bp1, join.bp2),
      Math.max(join.bp1, join.bp2),
      join.category,
      predecessorClip,
    )
  }
}

/**
 * Called once per SA entry with a reference span: the entry's refName as
 * `sa.slice(nameStart, nameEnd)`, its 0-based span, strand, clip at the start
 * of the read, MAPQ (NaN when the field is absent), and the read bases it
 * aligns (M, I, =, X).
 */
type SAEntryVisit = (
  nameStart: number,
  nameEnd: number,
  start: number,
  end: number,
  strand: number,
  clip: number,
  mapq: number,
  readBases: number,
) => void

/**
 * Every entry of an SA tag the read arcs keep (`saSegments`: a CIGAR, a
 * reference span, a numeric position), parsed in place, without
 * `featurizeSA`'s object, id string and mate record per entry.
 */
export function forEachSAEntry(sa: string, visit: SAEntryVisit) {
  const n = sa.length
  let i = 0
  while (i < n) {
    const semi = sa.indexOf(';', i)
    const entryEnd = semi === -1 ? n : semi
    const c1 = sa.indexOf(',', i)
    const c2 = c1 === -1 ? -1 : sa.indexOf(',', c1 + 1)
    const c3 = c2 === -1 ? -1 : sa.indexOf(',', c2 + 1)
    const c4 = c3 === -1 ? -1 : sa.indexOf(',', c3 + 1)
    const pos = c4 !== -1 && c4 < entryEnd ? digitsAt(sa, c1 + 1, c2) : NaN
    if (!Number.isNaN(pos)) {
      const start = pos - 1
      const strand = sa.charCodeAt(c2 + 1) === MINUS ? -1 : 1
      let refLength = 0
      let readBases = 0
      let firstClip = -1
      let lastClip = 0
      let len = 0
      for (let k = c3 + 1; k < c4; k++) {
        const code = sa.charCodeAt(k)
        if (code >= ZERO && code <= NINE) {
          len = len * 10 + code - ZERO
        } else {
          const clip = CLIP_OPS.has(code) ? len : 0
          if (firstClip === -1) {
            firstClip = clip
          }
          lastClip = clip
          if (REF_OPS.has(code)) {
            refLength += len
          }
          if (READ_OPS.has(code)) {
            readBases += len
          }
          len = 0
        }
      }
      if (refLength > 0) {
        const c5 = sa.indexOf(',', c4 + 1)
        visit(
          i,
          c1,
          start,
          start + refLength,
          strand,
          strand === -1 ? lastClip : Math.max(0, firstClip),
          digitsAt(sa, c4 + 1, c5 === -1 || c5 > entryEnd ? entryEnd : c5),
          readBases,
        )
      }
    }
    i = entryEnd + 1
  }
}

/**
 * The split junctions one record's segment makes with its read neighbours:
 * the SA segments just before and just after it in read order (by clip at the
 * start of the read). A neighbour on another reference breaks the adjacency
 * and joins nothing here. An SA entry the read arcs drop joins nothing either.
 */
export function forEachSplitJunction(
  segment: SplitPiece,
  sa: string,
  isHere: (refName: AdapterRefName) => boolean,
  visit: Visit,
) {
  const { clip: clipAtStart } = segment
  const near: { before?: Neighbour; after?: Neighbour } = {}
  forEachSAEntry(
    sa,
    (nameStart, nameEnd, start, end, strand, clip, _mapq, alignedBases) => {
      if (clip < clipAtStart && clip > (near.before?.clip ?? -1)) {
        near.before = {
          here: isHere(adapterRefName(sa.slice(nameStart, nameEnd))),
          strand,
          start,
          end,
          clip,
          alignedBases,
        }
      } else if (clip > clipAtStart && clip < (near.after?.clip ?? Infinity)) {
        near.after = {
          here: isHere(adapterRefName(sa.slice(nameStart, nameEnd))),
          strand,
          start,
          end,
          clip,
          alignedBases,
        }
      }
    },
  )
  const { before, after } = near
  if (before?.here) {
    visitJoin(before, segment, before.clip, visit)
  }
  if (after?.here) {
    visitJoin(segment, after, -1, visit)
  }
}

interface Neighbour extends SplitPiece {
  here: boolean
}

export interface SplitJunction {
  start: number
  end: number
  splitClass: number
  n: number
}

interface SplitRecords {
  features: readonly FeatureData[]
  suppAlignments: readonly string[] | undefined
  clipAtStart: readonly number[]
  alignedBases: readonly number[]
  readNames: ReadNames
}

// Which read of a pair a record is, 0 when unpaired: SA entries name the
// segments of one mate only.
function mateOf(flags: number) {
  return (
    (flags & SAM_FLAG_FIRST_IN_PAIR ? 1 : 0) +
    (flags & SAM_FLAG_SECOND_IN_PAIR ? 2 : 0)
  )
}

/** The split segments one fetch holds, by QNAME: `clip * 4 + mate` each. */
export type FetchedSegments = ReadonlyMap<string, readonly number[]>

/**
 * Every split segment in one region's fetch, across all its groups, so each
 * group can tell a predecessor fetched into a sibling group from one this
 * region never fetched.
 */
export function fetchedSplitSegments(groups: Iterable<SplitRecords>) {
  const out = new Map<string, number[]>()
  for (const { features, suppAlignments, clipAtStart, readNames } of groups) {
    if (suppAlignments) {
      for (let i = 0; i < features.length; i++) {
        const { flags } = features[i]!
        const name = suppAlignments[i] ? readNameAt(readNames, i) : ''
        if (name && !(flags & SAM_FLAG_SECONDARY)) {
          const segment = clipAtStart[i]! * 4 + mateOf(flags)
          const list = out.get(name)
          if (list) {
            list.push(segment)
          } else {
            out.set(name, [segment])
          }
        }
      }
    }
  }
  return out
}

/**
 * Same-reference split-read junctions, counted the way the read arcs count
 * `support`: once per read-adjacent pair of segments, so each mate counts
 * separately and a rolling-circle read counts every crossing. A join belongs
 * to the earlier segment in read order, and counts here when that segment's
 * record is in `records`, or when this region's fetch (`fetched`) lacks it
 * and the later one stands in. A primary and its supplementary never count
 * twice, a junction lands in the group holding its earlier segment, and every
 * region holding a junction foot sees its full count. Secondary alignments are
 * another mapping of the same bases and join nothing, and an insertion
 * junction spans no reference to draw an arc over.
 */
export function computeSplitJunctions({
  refName,
  features,
  suppAlignments,
  clipAtStart,
  alignedBases,
  readNames,
  fetched,
}: SplitRecords & { refName: string; fetched: FetchedSegments }) {
  const out: SplitJunction[] = []
  if (!suppAlignments) {
    return out
  }
  const byStart = new Map<number, SplitJunction[]>()
  let record = 0
  let mate = 0
  const here = adapterRefName(refName)
  const isHere = (name: AdapterRefName) => name === here
  const visit: Visit = (start, end, split, predecessorClip) => {
    if (
      split !== 'splitInsertion' &&
      (predecessorClip === -1 ||
        !fetched
          .get(readNameAt(readNames, record))
          ?.includes(predecessorClip * 4 + mate))
    ) {
      const splitClass = splitClassCode(split)
      let list = byStart.get(start)
      if (!list) {
        list = []
        byStart.set(start, list)
      }
      const j = list.find(j => j.end === end && j.splitClass === splitClass)
      if (j) {
        j.n++
      } else {
        const junction = { start, end, splitClass, n: 1 }
        list.push(junction)
        out.push(junction)
      }
    }
  }
  for (let i = 0; i < features.length; i++) {
    const sa = suppAlignments[i]
    const f = features[i]!
    if (sa && !(f.flags & SAM_FLAG_SECONDARY)) {
      record = i
      mate = mateOf(f.flags)
      forEachSplitJunction(
        {
          start: f.start,
          end: f.end,
          strand: f.strand,
          clip: clipAtStart[i]!,
          alignedBases: alignedBases[i]!,
        },
        sa,
        isHere,
        visit,
      )
    }
  }
  return out
}
