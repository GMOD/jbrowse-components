import { Feature } from '@jbrowse/core/util'

import { parseBreakend, Breakend } from '@gmod/vcf'

// this finds candidate alignment features, aimed at plotting split reads
// from BAM/CRAM files
export function getBadlyPairedAlignments(features: Map<string, Feature>) {
  const candidates: Record<string, Feature[]> = {}
  const alreadySeen = new Set<string>()

  // this finds candidate features that share the same name
  for (const feature of features.values()) {
    const flags = feature.get('flags')
    const id = feature.id()
    const unmapped = flags & 4
    const correctlyPaired = flags & 2

    if (!alreadySeen.has(id) && !correctlyPaired && !unmapped) {
      const n = feature.get('name')
      if (!candidates[n]) {
        candidates[n] = []
      }
      candidates[n].push(feature)
    }
    alreadySeen.add(feature.id())
  }

  return Object.values(candidates).filter(v => v.length > 1)
}

// this finds candidate alignment features, aimed at plotting split reads
// from BAM/CRAM files
export function getMatchedAlignmentFeatures(features: Map<string, Feature>) {
  const candidates: Record<string, Feature[]> = {}
  const alreadySeen = new Set<string>()

  // this finds candidate features that share the same name
  for (const feature of features.values()) {
    const id = feature.id()
    const unmapped = feature.get('flags') & 4
    if (!alreadySeen.has(id) && !unmapped) {
      const n = feature.get('name')
      if (!candidates[n]) {
        candidates[n] = []
      }
      candidates[n].push(feature)
    }
    alreadySeen.add(feature.id())
  }

  return Object.values(candidates).filter(v => v.length > 1)
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
    return Object.fromEntries(
      alts
        ?.map(alt => parseBreakend(alt))
        .filter((f): f is Breakend => !!f)
        .map(bnd => [bnd.MatePosition, bnd]),
    )[`${feat2.get('refName')}:${feat2.get('start') + 1}`]
  }
  return undefined
}

// Returns paired BND features across multiple views by inspecting
// the ALT field to get exact coordinate matches
export function getMatchedBreakendFeatures(feats: Map<string, Feature>) {
  const candidates: Record<string, Feature[]> = {}
  const alreadySeen = new Set<string>()

  for (const f of feats.values()) {
    if (!alreadySeen.has(f.id())) {
      if (f.get('type') === 'breakend') {
        const alts = f.get('ALT') as string[] | undefined
        alts?.forEach(a => {
          const cur = `${f.get('refName')}:${f.get('start') + 1}`
          const bnd = parseBreakend(a)
          if (bnd) {
            if (!candidates[cur]) {
              candidates[bnd.MatePosition || 'none'] = [f]
            } else {
              candidates[cur].push(f)
            }
          }
        })
      }
    }
    alreadySeen.add(f.id())
  }

  return Object.values(candidates).filter(v => v.length > 1)
}

// Getting "matched" TRA means just return all TRA
export function getMatchedTranslocationFeatures(feats: Map<string, Feature>) {
  const ret: Feature[][] = []
  const alreadySeen = new Set<string>()

  for (const f of feats.values()) {
    if (!alreadySeen.has(f.id())) {
      if (f.get('ALT')[0] === '<TRA>') {
        ret.push([f])
      }
    }
    alreadySeen.add(f.id())
  }

  return ret
}
