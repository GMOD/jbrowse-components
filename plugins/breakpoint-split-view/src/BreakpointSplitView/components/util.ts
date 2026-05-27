import { parseBreakend } from '@gmod/vcf'
import { assembleLocStringFast, notEmpty } from '@jbrowse/core/util'

import { getPairedOrientation } from './getOrientationColor.tsx'

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
    const flags = feature.get('flags')
    const locString = assembleLocStringFast({
      refName: feature.get('refName'),
      start: feature.get('start'),
      end: feature.get('end'),
    })
    const unmapped = flags & 4
    const correctlyPaired = flags & 2
    // Include reads that either don't have the proper-pair flag set, or have
    // it set but a non-LR orientation (LL/RR same-strand, RL outie).
    const isBadlyPaired =
      !correctlyPaired ||
      getPairedOrientation({
        pair_orientation: feature.get('pair_orientation'),
      }).abnormal

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

export function getMatchedAlignmentFeatures(features: Map<string, Feature>) {
  const candidates = new Map<string, Feature[]>()
  for (const f of features.values()) {
    if (!(f.get('flags') & 4) && f.get('tags')?.SA) {
      bucket(candidates, f.get('name')!, f)
    }
  }
  return multi(candidates)
}

export function hasPairedReads(features: Map<string, Feature>) {
  for (const f of features.values()) {
    if (f.get('flags') & 1) {
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
    if (f.get('ALT')?.[0] === '<TRA>') {
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
