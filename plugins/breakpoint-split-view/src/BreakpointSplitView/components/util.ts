import { parseBreakend } from '@gmod/vcf'
import {
  isAbnormalPairDirection,
  pairDirection,
} from '@jbrowse/alignments-core'
import { featurizeSAEntries, getClip, splitSA } from '@jbrowse/cigar-utils'
import { assembleLocStringFast, notEmpty } from '@jbrowse/core/util'

import type { ChainSegment, LayoutMatch } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

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
    const key = `${name}\t${assembleLocStringFast({
      refName: feature.get('refName'),
      start: feature.get('start'),
      end: feature.get('end'),
    })}`
    const unmapped = flags & 4
    const correctlyPaired = flags & 2
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
// (each SA lists the read's other alignments). featurizeSA (normalize=false)
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
    const SA = (feature.get('tags') as Record<string, unknown> | undefined)
      ?.SA as string | undefined
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
          assembleLocStringFast({
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
    if (
      !((f.get('flags') as number) & 4) &&
      (f.get('tags') as Record<string, unknown> | undefined)?.SA
    ) {
      bucket(candidates, f.get('name')!, f)
    }
  }
  return multi(candidates)
}

export function hasPairedReads(features: Map<string, Feature>) {
  for (const f of features.values()) {
    if ((f.get('flags') as number) & 1) {
      return true
    }
  }
  return false
}

export function findMatchingAlt(feat1: Feature, feat2: Feature) {
  const alts = feat1.get('ALT') as string[] | undefined
  const target = `${feat2.get('refName')}:${feat2.get('start') + 1}`
  return alts
    ?.map(alt => parseBreakend(alt))
    .filter(notEmpty)
    .find(bnd => bnd.MatePosition === target)
}

export function getMatchedBreakendFeatures(feats: Map<string, Feature>) {
  const candidates = new Map<string, Feature[]>()
  for (const f of feats.values()) {
    if (f.get('type') !== 'breakend') {
      continue
    }
    const alts = f.get('ALT') as string[] | undefined
    if (!alts) {
      continue
    }
    const cur = `${f.get('refName')}:${f.get('start') + 1}`
    for (const a of alts) {
      const bnd = parseBreakend(a)
      if (bnd?.MatePosition) {
        // canonical key so feature A→B and feature B→A land in the same bucket
        bucket(candidates, [cur, bnd.MatePosition].sort().join('\t'), f)
      }
    }
  }
  return multi(candidates)
}

// Getting "matched" TRA means just return all TRA
export function getMatchedTranslocationFeatures(feats: Map<string, Feature>) {
  const ret: Feature[][] = []
  for (const f of feats.values()) {
    if ((f.get('ALT') as string[] | undefined)?.[0] === '<TRA>') {
      ret.push([f])
    }
  }
  return ret
}

// Feature types whose adapter emits one record as two halves, each anchored at
// one endpoint and carrying `mate` pointing at the other: bedpe
// (`paired_feature`) and STAR-Fusion (`fusion`). They differ only in the type
// string, so they rejoin identically — see getMatchedPairedFeatures.
const pairedFeatureTypes = new Set(['paired_feature', 'fusion'])

function isPairedFeature(f: Feature) {
  const type = f.get('type')
  return type === undefined ? false : pairedFeatureTypes.has(type)
}

export function classifyVariantFeatures(features: Map<string, Feature>) {
  let hasTranslocation = false
  let hasPaired = false
  for (const f of features.values()) {
    if (f.get('type') === 'translocation') {
      hasTranslocation = true
      break
    }
    if (isPairedFeature(f)) {
      hasPaired = true
    }
  }
  return hasTranslocation
    ? ('translocation' as const)
    : hasPaired
      ? ('paired' as const)
      : ('breakend' as const)
}

// Each half of a paired record is anchored at one endpoint and carries `mate`
// pointing at the other, so the unordered pair of loc strings is identical for
// the two halves and unique to the record. Same canonical-key trick as
// getMatchedBreakendFeatures.
//
// Don't be tempted back to the feature's uniqueId: the adapter mints it as
// `<prefix>-<refName>-<index>-r1|r2`, where the index counts within that
// refName's bucket. The two halves of one record therefore disagree on both the
// refName and the index, so stripping the `-r1`/`-r2` suffix neither rejoins a
// real pair nor keeps unrelated ones apart.
export function getMatchedPairedFeatures(feats: Map<string, Feature>) {
  const candidates = new Map<string, Feature[]>()
  for (const f of feats.values()) {
    const mate = f.get('mate') as
      | { refName: string; start: number; end: number }
      | undefined
    if (!isPairedFeature(f) || !mate) {
      continue
    }
    const self = assembleLocStringFast({
      refName: f.get('refName'),
      start: f.get('start'),
      end: f.get('end'),
    })
    bucket(candidates, [self, assembleLocStringFast(mate)].sort().join('\t'), f)
  }
  return multi(candidates)
}
