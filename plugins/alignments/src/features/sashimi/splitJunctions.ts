import { readNameAt, splitJunctionKind } from '@jbrowse/alignments-core'
import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SECONDARY,
  readLeadingBodyDir,
  readLeadingBp,
  readTrailingBodyDir,
  readTrailingBp,
} from '@jbrowse/cigar-utils'

import { ARC_SLOT_CATEGORY } from '../../shaders/palettes.ts'
import { splitJunctionSlot } from '../arcs/arcColors.ts'
import { SPLIT_JUNCTION_CLASSES, splitClassCode } from './junctionClass.ts'

import type { FeatureData } from '../../shared/webglRpcTypes.ts'
import type { ReadNames } from '@jbrowse/alignments-core'

const CODE_OF_SLOT = new Map(
  SPLIT_JUNCTION_CLASSES.map(c => [
    ARC_SLOT_CATEGORY.indexOf(c),
    splitClassCode(c),
  ]),
)

const MINUS = 45
const ZERO = 48
const NINE = 57
const CLIP_OPS = new Set(['S', 'H'].map(c => c.charCodeAt(0)))
const REF_OPS = new Set(['M', 'D', 'N', '=', 'X'].map(c => c.charCodeAt(0)))

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
  splitClass: number,
  predecessorClip: number,
) => void

// The junction from segment 1's read-trailing edge to segment 2's
// read-leading edge, classed as the read arcs class it (`splitJunctionColor`).
// A join whose feet share a base spans nothing to draw.
function visitJoin(
  s1: number,
  start1: number,
  end1: number,
  s2: number,
  start2: number,
  end2: number,
  predecessorClip: number,
  visit: Visit,
) {
  const kind = splitJunctionKind(s1, s2)
  const bp1 = readTrailingBp(s1, start1, end1)
  const bp2 = readLeadingBp(s2, start2, end2)
  if (kind !== undefined && bp1 !== bp2) {
    const lowerDir =
      bp1 < bp2 ? readTrailingBodyDir(s1) : readLeadingBodyDir(s2)
    visit(
      Math.min(bp1, bp2),
      Math.max(bp1, bp2),
      CODE_OF_SLOT.get(splitJunctionSlot(kind === 'inversion', lowerDir))!,
      predecessorClip,
    )
  }
}

/**
 * The split junctions one record's segment makes with its read neighbours:
 * the SA segments just before and just after it in read order (by clip at the
 * start of the read). A neighbour on another reference breaks the adjacency
 * and joins nothing here. An SA entry the read arcs drop (`saSegments`: no
 * CIGAR, no reference span, a non-numeric position) joins nothing either.
 * Parses the SA tag in place, without `featurizeSA`'s object, id string and
 * mate record per entry.
 */
export function forEachSplitJunction(
  segment: { start: number; end: number; strand: number; clipAtStart: number },
  sa: string,
  isHere: (refName: string) => boolean,
  visit: Visit,
) {
  const { clipAtStart } = segment
  let beforeClip = -1
  let beforeHere = false
  let beforeStrand = 0
  let beforeStart = 0
  let beforeEnd = 0
  let afterClip = Infinity
  let afterHere = false
  let afterStrand = 0
  let afterStart = 0
  let afterEnd = 0
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
          len = 0
        }
      }
      const clip = strand === -1 ? lastClip : Math.max(0, firstClip)
      if (refLength > 0) {
        if (clip < clipAtStart && clip > beforeClip) {
          beforeClip = clip
          beforeHere = isHere(sa.slice(i, c1))
          beforeStrand = strand
          beforeStart = start
          beforeEnd = start + refLength
        } else if (clip > clipAtStart && clip < afterClip) {
          afterClip = clip
          afterHere = isHere(sa.slice(i, c1))
          afterStrand = strand
          afterStart = start
          afterEnd = start + refLength
        }
      }
    }
    i = entryEnd + 1
  }
  if (beforeHere) {
    visitJoin(
      beforeStrand,
      beforeStart,
      beforeEnd,
      segment.strand,
      segment.start,
      segment.end,
      beforeClip,
      visit,
    )
  }
  if (afterHere) {
    visitJoin(
      segment.strand,
      segment.start,
      segment.end,
      afterStrand,
      afterStart,
      afterEnd,
      -1,
      visit,
    )
  }
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
 * another mapping of the same bases and join nothing.
 */
export function computeSplitJunctions({
  refName,
  features,
  suppAlignments,
  clipAtStart,
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
  const isHere = (name: string) => name === refName
  const visit: Visit = (start, end, splitClass, predecessorClip) => {
    if (
      predecessorClip === -1 ||
      !fetched
        .get(readNameAt(readNames, record))
        ?.includes(predecessorClip * 4 + mate)
    ) {
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
          clipAtStart: clipAtStart[i]!,
        },
        sa,
        isHere,
        visit,
      )
    }
  }
  return out
}
