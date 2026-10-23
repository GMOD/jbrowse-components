import { readNameAt, splitJunctionKind } from '@jbrowse/alignments-core'
import {
  SAM_FLAG_SECONDARY,
  readLeadingBodyDir,
  readLeadingBp,
  readTrailingBodyDir,
  readTrailingBp,
} from '@jbrowse/cigar-utils'

import { ARC_SLOT_CATEGORY } from '../../shaders/palettes.ts'
import { chainGroupingKey } from '../../shared/chainGroupingKey.ts'
import { splitJunctionSlot } from '../arcs/arcColors.ts'
import { SPLIT_JUNCTION_CLASSES, splitClassCode } from './junctionClass.ts'

import type { FeatureData } from '../../shared/webglRpcTypes.ts'
import type { ReadKey, ReadNames } from '@jbrowse/alignments-core'

const MAX_SPLIT_JUNCTION_SPAN = 200_000

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

function digitsAt(s: string, from: number, to: number) {
  let n = 0
  for (let i = from; i < to; i++) {
    n = n * 10 + s.charCodeAt(i) - ZERO
  }
  return n
}

type Visit = (start: number, end: number, splitClass: number) => void

// The junction from segment 1's read-trailing edge to segment 2's
// read-leading edge, classed as the read arcs class it (`splitJunctionColor`).
function visitJoin(
  s1: number,
  start1: number,
  end1: number,
  s2: number,
  start2: number,
  end2: number,
  visit: Visit,
) {
  const kind = splitJunctionKind(s1, s2)
  const bp1 = readTrailingBp(s1, start1, end1)
  const bp2 = readLeadingBp(s2, start2, end2)
  if (
    kind !== undefined &&
    bp1 !== bp2 &&
    Math.abs(bp2 - bp1) <= MAX_SPLIT_JUNCTION_SPAN
  ) {
    const lowerDir =
      bp1 < bp2 ? readTrailingBodyDir(s1) : readLeadingBodyDir(s2)
    visit(
      Math.min(bp1, bp2),
      Math.max(bp1, bp2),
      CODE_OF_SLOT.get(splitJunctionSlot(kind === 'inversion', lowerDir))!,
    )
  }
}

/**
 * The split junctions one record's segment makes with its read neighbours:
 * the SA segments just before and just after it in read order (by clip at the
 * start of the read). A neighbour on another reference breaks the adjacency
 * and joins nothing here. Parses the SA tag in place, without `featurizeSA`'s
 * object, id string and mate record per entry.
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
    const c1 = sa.indexOf(',', i)
    const c2 = c1 === -1 ? -1 : sa.indexOf(',', c1 + 1)
    const c3 = c2 === -1 ? -1 : sa.indexOf(',', c2 + 1)
    const c4 = c3 === -1 ? -1 : sa.indexOf(',', c3 + 1)
    if (c4 === -1) {
      break
    }
    const start = digitsAt(sa, c1 + 1, c2) - 1
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
    const next = sa.indexOf(';', c4 + 1)
    i = next === -1 ? n : next + 1
  }
  if (beforeHere) {
    visitJoin(
      beforeStrand,
      beforeStart,
      beforeEnd,
      segment.strand,
      segment.start,
      segment.end,
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

/**
 * Same-reference split-read junctions, counted once per read per junction:
 * each record contributes the joins its own segment makes, so a read whose
 * primary and supplementary land in different regions still counts in each,
 * and a rolling-circle read crossing one joint on every pass counts once.
 * Secondary alignments are another mapping of the same bases and join
 * nothing.
 */
export function computeSplitJunctions({
  refName,
  features,
  suppAlignments,
  clipAtStart,
  readNames,
}: {
  refName: string
  features: readonly FeatureData[]
  suppAlignments: readonly string[] | undefined
  clipAtStart: readonly number[]
  readNames: ReadNames
}) {
  const counts = new Map<string, SplitJunction>()
  if (!suppAlignments) {
    return counts
  }
  const seen = new Set<string>()
  let read: ReadKey = ''
  const isHere = (name: string) => name === refName
  const visit: Visit = (start, end, splitClass) => {
    const key = `${start}:${end}:${splitClass}`
    const readJunction = `${read}\0${key}`
    if (!seen.has(readJunction)) {
      seen.add(readJunction)
      const j = counts.get(key)
      if (j) {
        j.n++
      } else {
        counts.set(key, { start, end, splitClass, n: 1 })
      }
    }
  }
  for (const [i, f] of features.entries()) {
    const sa = suppAlignments[i]
    if (sa && !(f.flags & SAM_FLAG_SECONDARY)) {
      read = chainGroupingKey(readNameAt(readNames, i), f.id, f.flags)
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
  return counts
}
