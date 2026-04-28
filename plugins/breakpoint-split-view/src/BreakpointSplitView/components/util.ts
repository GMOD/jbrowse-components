import { parseBreakend } from '@gmod/vcf'
import { assembleLocStringFast, notEmpty } from '@jbrowse/core/util'

import type { Feature } from '@jbrowse/core/util'

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

    if (
      !alreadyPairedWithSamePosition.has(locString) &&
      !correctlyPaired &&
      !unmapped
    ) {
      const n = feature.get('name')!
      let val = candidates.get(n)
      if (!val) {
        val = []
        candidates.set(n, val)
      }
      val.push(feature)
    }
    alreadyPairedWithSamePosition.add(locString)
  }

  return [...candidates.values()].filter(v => v.length > 1)
}

export function getMatchedAlignmentFeatures(features: Map<string, Feature>) {
  const candidates = new Map<string, Feature[]>()

  for (const feature of features.values()) {
    const unmapped = feature.get('flags') & 4
    const hasSA = !!feature.get('tags')?.SA
    if (!unmapped && hasSA) {
      const n = feature.get('name')!
      let val = candidates.get(n)
      if (!val) {
        val = []
        candidates.set(n, val)
      }
      val.push(feature)
    }
  }

  return [...candidates.values()].filter(v => v.length > 1)
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
  if (alts) {
    return new Map(
      alts
        .map(alt => parseBreakend(alt))
        .filter(notEmpty)
        .map(bnd => [bnd.MatePosition, bnd]),
    ).get(`${feat2.get('refName')}:${feat2.get('start') + 1}`)
  }
  return undefined
}

export function getMatchedBreakendFeatures(feats: Map<string, Feature>) {
  const candidates = new Map<string, Feature[]>()

  for (const f of feats.values()) {
    if (f.get('type') === 'breakend') {
      const alts = f.get('ALT') as string[] | undefined
      if (alts) {
        for (const a of alts) {
          const cur = `${f.get('refName')}:${f.get('start') + 1}`
          const bnd = parseBreakend(a)
          if (bnd?.MatePosition) {
            // canonical key so feature A→B and feature B→A land in the same bucket
            const key = [cur, bnd.MatePosition].sort().join('\t')
            let val = candidates.get(key)
            if (!val) {
              val = []
              candidates.set(key, val)
            }
            val.push(f)
          }
        }
      }
    }
  }

  return [...candidates.values()].filter(v => v.length > 1)
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
    if (f.get('type') === 'paired_feature') {
      const baseId = f.id().replace(/-r[12]$/, '')
      if (f.id() !== baseId) {
        let val = candidates.get(baseId)
        if (!val) {
          val = []
          candidates.set(baseId, val)
        }
        val.push(f)
      }
    }
  }

  return [...candidates.values()].filter(v => v.length > 1)
}
