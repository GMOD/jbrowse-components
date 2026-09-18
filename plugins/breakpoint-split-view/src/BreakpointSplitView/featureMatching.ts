import {
  isAbnormalPairDirection,
  pairDirection,
} from '@jbrowse/alignments-core'
import {
  SAM_FLAG_PAIRED,
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_UNMAPPED,
  featurizeSAEntries,
  getClip,
  splitSA,
} from '@jbrowse/cigar-utils'
import { assembleLocString, assembleLocStringRaw } from '@jbrowse/core/util'
import { getTag } from '@jbrowse/modifications-utils'
import { breakendLocKey, junctionEnds } from '@jbrowse/sv-core'

import type { ChainSegment, LayoutMatch } from './types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JunctionEnd } from '@jbrowse/sv-core'

function bucket<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const arr = map.get(key)
  if (arr) {
    arr.push(value)
  } else {
    map.set(key, [value])
  }
}

function multi<K, V>(map: Map<K, V[]>) {
  return [...map.values()].filter(v => v.length > 1)
}

export function getBadlyPairedAlignments(features: Map<string, Feature>) {
  const candidates = new Map<string, Feature[]>()
  // Reads of one pair that land on the same span would connect a read to
  // itself: a degenerate arc pinned to a single spot. Keep only the first at a
  // given (name, span) so the name's bucket falls below the two multi()
  // requires and nothing is drawn.
  //
  // The name belongs in the key. Keying on the span alone (what this was) also
  // dropped *unrelated* reads that happened to share an identical span, which
  // silently lost their pair's connection and made the result depend on
  // iteration order. Everything this suppresses shares a name with what it
  // would otherwise pair to, so scoping per name loses nothing.
  const seenNameAtPosition = new Set<string>()

  for (const feature of features.values()) {
    const flags = feature.get('flags') as number
    const name = feature.get('name')!
    const key = `${name}\t${assembleLocStringRaw({
      refName: feature.get('refName'),
      start: feature.get('start'),
      end: feature.get('end'),
    })}`
    const unmapped = flags & SAM_FLAG_UNMAPPED
    const correctlyPaired = flags & SAM_FLAG_PROPER_PAIR
    // Include reads that either don't have the proper-pair flag set, or have
    // it set but a non-LR orientation (LL/RR same-strand, RL outie).
    const dir = pairDirection(
      feature.get('pair_orientation') as string | undefined,
    )
    const isBadlyPaired = !correctlyPaired || isAbnormalPairDirection(dir)

    if (!seenNameAtPosition.has(key) && isBadlyPaired && !unmapped) {
      bucket(candidates, name, feature)
    }
    seenNameAtPosition.add(key)
  }

  return multi(candidates)
}

// A segment's position on the read's 5' axis, used to sort a split read's
// alignments into read order. Core alignment adapters expose it directly; derive
// it from the CIGAR for any that don't, rather than letting a missing field
// collapse every segment to 0 and silently no-op the read-order sort.
export function getClipLengthAtStartOfRead(feature: Feature) {
  const derived = feature.get('clipLengthAtStartOfRead') as number | undefined
  return (
    derived ??
    getClip(
      (feature.get('CIGAR') as string | undefined) ?? '',
      (feature.get('strand') as number | undefined) ?? 1,
    )
  )
}

// The read's full alignment chain, derived from the SA tags of its segments
// (each SA lists the read's other alignments). This file holds all four of the
// joins `agent-docs/mechanisms/split-read-chains.md` is about.
// featurizeSA (normalize=false)
// yields clip positions on the same original-read 5' axis as
// feature.clipLengthAtStartOfRead, so they're directly comparable — a chain clip
// strictly between two adjacent visible segments belongs to an alignment that
// maps to a region no view currently shows. Deduped by clip.
export function readChainSegments(features: Feature[]) {
  const byClip = new Map<number, ChainSegment>()
  // A chunk's segments all belong to one read, so each names the same chain and
  // their SA tags overwhelmingly repeat the same alignment records — an n-segment
  // read describes each alignment n-1 times. The entries are identical text and
  // (with normalize=false) featurize independently of the feature they came from,
  // so parsing each distinct one once is the same chain at O(n) CIGAR parses
  // instead of O(n^2).
  const seen = new Set<string>()
  for (const feature of features) {
    // getTag, not get('tags'): the latter decodes every tag on the read to
    // answer one, and this runs per segment of every chained read on screen
    const SA = getTag(feature, 'SA') as string | undefined
    const novel = SA === undefined ? [] : splitSA(SA).filter(a => !seen.has(a))
    if (!novel.length) {
      continue
    }
    for (const aln of novel) {
      seen.add(aln)
    }
    for (const sa of featurizeSAEntries(
      novel,
      feature.id(),
      feature.get('strand'),
      feature.get('name'),
    )) {
      byClip.set(sa.clipLengthAtStartOfRead, {
        clip: sa.clipLengthAtStartOfRead,
        refName: sa.refName,
        start: sa.start,
        end: sa.end,
      })
    }
  }
  return [...byClip.values()].sort((a, b) => a.clip - b.clip)
}

// Records, for each clip-sorted split-read segment, the loc strings of any read
// segments that fall between it and its predecessor but aren't shown in any
// view. Comparing against real alignment records (the SA-derived `chain`, from
// readChainSegments) rather than raw read-coordinate gaps avoids false positives
// from unaligned or soft-clipped stretches. Mutates the chunk in place.
export function markHiddenSegments(
  chunk: LayoutMatch[],
  chain: ChainSegment[],
) {
  for (let i = 1; i < chunk.length; i++) {
    const prev = chunk[i - 1]!.clipLengthAtStartOfRead
    const cur = chunk[i]!.clipLengthAtStartOfRead
    const hidden = chain.filter(s => s.clip > prev && s.clip < cur)
    chunk[i]!.hiddenSegmentsBefore = hidden.length
      ? hidden.map(s =>
          assembleLocString({
            refName: s.refName,
            start: s.start,
            end: s.end,
          }),
        )
      : undefined
  }
}

export function getMatchedAlignmentFeatures(features: Map<string, Feature>) {
  const candidates = new Map<string, Feature[]>()
  for (const f of features.values()) {
    // getTag, not get('tags'): this walks every fetched feature, and the full
    // tags decode allocates a Record per read to answer one presence check
    if (!((f.get('flags') as number) & SAM_FLAG_UNMAPPED) && getTag(f, 'SA')) {
      bucket(candidates, f.get('name')!, f)
    }
  }
  return multi(candidates)
}

export function hasPairedReads(features: Map<string, Feature>) {
  for (const f of features.values()) {
    if ((f.get('flags') as number) & SAM_FLAG_PAIRED) {
      return true
    }
  }
  return false
}

function endKey(end: JunctionEnd) {
  return breakendLocKey(`${end.refName}:${end.pos}`)
}

/**
 * Variant records, one junction per chunk: a record, then the record at its
 * mate end when the fetch holds one — the other half of a reciprocal BND pair,
 * or of a row a paired adapter (BEDPE, STAR-Fusion) files under both contigs.
 * A record written once, or whose mate record fell to a filter, is a chunk of
 * one, and the overlay draws it to its mate position all the same. Records
 * naming no other end are dropped.
 */
export function getVariantJunctions(feats: Map<string, Feature>) {
  const byJunction = new Map<
    string,
    { feature: Feature; ends: NonNullable<ReturnType<typeof junctionEnds>> }[]
  >()
  for (const feature of feats.values()) {
    const ends = junctionEnds(feature)
    if (ends) {
      bucket(
        byJunction,
        [endKey(ends.own), endKey(ends.mate)].sort().join('\t'),
        { feature, ends },
      )
    }
  }
  return [...byJunction.values()].map(([first, ...rest]) => {
    const mateKey = endKey(first!.ends.mate)
    const atMate = rest.find(r => endKey(r.ends.own) === mateKey)
    return atMate ? [first!.feature, atMate.feature] : [first!.feature]
  })
}
