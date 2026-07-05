import { parseBreakend } from '@gmod/vcf'
import {
  isAbnormalPairDirection,
  pairDirection,
} from '@jbrowse/alignments-core'
import { featurizeSA, getClip } from '@jbrowse/cigar-utils'
import { assembleLocStringFast, notEmpty } from '@jbrowse/core/util'

import type { LayoutMatch } from '../types.ts'
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
  const alreadyPairedWithSamePosition = new Set<string>()

  for (const feature of features.values()) {
    const flags = feature.get('flags') as number
    const locString = assembleLocStringFast({
      refName: feature.get('refName'),
      start: feature.get('start'),
      end: feature.get('end'),
    })
    const unmapped = flags & 4
    const correctlyPaired = flags & 2
    // Include reads that either don't have the proper-pair flag set, or have
    // it set but a non-LR orientation (LL/RR same-strand, RL outie).
    const dir = pairDirection(
      feature.get('pair_orientation') as string | undefined,
    )
    const isBadlyPaired = !correctlyPaired || isAbnormalPairDirection(dir)

    if (
      !alreadyPairedWithSamePosition.has(locString) &&
      isBadlyPaired &&
      !unmapped
    ) {
      bucket(candidates, feature.get('name')!, feature)
    }
    alreadyPairedWithSamePosition.add(locString)
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

interface ChainSegment {
  clip: number
  refName: string
  start: number
  end: number
}

// The read's full alignment chain, derived from the SA tags of the visible
// segments (each SA lists the read's other alignments). featurizeSA
// (normalize=false) yields clip positions on the same original-read 5' axis as
// feature.clipLengthAtStartOfRead, so they're directly comparable — a chain clip
// strictly between two adjacent visible segments belongs to an alignment that
// maps to a region no view currently shows. Deduped by clip.
function readChainSegments(chunk: LayoutMatch[]) {
  const byClip = new Map<number, ChainSegment>()
  for (const { feature } of chunk) {
    const SA = (feature.get('tags') as Record<string, unknown> | undefined)
      ?.SA as string | undefined
    for (const sa of featurizeSA(
      SA,
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
// view. Comparing against real alignment records (the SA-derived chain) rather
// than raw read-coordinate gaps avoids false positives from unaligned or
// soft-clipped stretches. Mutates the chunk in place.
export function markHiddenSegments(chunk: LayoutMatch[]) {
  const chain = readChainSegments(chunk)
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

export function classifyVariantFeatures(features: Map<string, Feature>) {
  let hasTranslocation = false
  let hasPaired = false
  for (const f of features.values()) {
    const t = f.get('type')
    if (t === 'translocation') {
      hasTranslocation = true
      break
    }
    if (t === 'paired_feature') {
      hasPaired = true
    }
  }
  return hasTranslocation
    ? ('translocation' as const)
    : hasPaired
      ? ('paired' as const)
      : ('breakend' as const)
}

export function getMatchedPairedFeatures(feats: Map<string, Feature>) {
  const candidates = new Map<string, Feature[]>()
  for (const f of feats.values()) {
    if (f.get('type') !== 'paired_feature') {
      continue
    }
    const baseId = f.id().replace(/-r[12]$/, '')
    if (f.id() !== baseId) {
      bucket(candidates, baseId, f)
    }
  }
  return multi(candidates)
}
