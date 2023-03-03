import { Feature } from '@jbrowse/core/util'

import { parseBreakend, Breakend } from '@gmod/vcf'

// this finds candidate alignment features, aimed at plotting split reads
// from BAM/CRAM files
export function getBadlyPairedAlignments(features: Map<string, Feature>) {
  const candidates = new Map<string, Feature[]>()
  const alreadySeen = new Set<string>()

  // this finds candidate features that share the same name
  for (const feature of features.values()) {
    const flags = feature.get('flags')
    const id = feature.id()
    const unmapped = flags & 4
    const correctlyPaired = flags & 2

    if (!alreadySeen.has(id) && !correctlyPaired && !unmapped) {
      const n = feature.get('name')
      let val = candidates.get(n)
      if (!val) {
        val = []
        candidates.set(n, val)
      }
      val.push(feature)
    }
    alreadySeen.add(feature.id())
  }

  return [...candidates.values()].filter(v => v.length > 1)
}

function getTag(f: Feature, tag: string) {
  const tags = f.get('tags')
  return tags ? tags[tag] : f.get(tag)
}

// this finds candidate alignment features, aimed at plotting split reads
// from BAM/CRAM files
export function getMatchedAlignmentFeatures(features: Map<string, Feature>) {
  const candidates = new Map<string, Feature[]>()
  const alreadySeen = new Set<string>()

  // this finds candidate features that share the same name
  for (const feature of features.values()) {
    const id = feature.id()
    const unmapped = feature.get('flags') & 4
    const hasSA = !!getTag(feature, 'SA')
    if (!alreadySeen.has(id) && !unmapped && hasSA) {
      const n = feature.get('name')
      let val = candidates.get(n)
      if (!val) {
        val = []
        candidates.set(n, val)
      }
      val.push(feature)
    }
    alreadySeen.add(feature.id())
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
        ?.map(alt => parseBreakend(alt))
        .filter((f): f is Breakend => !!f)
        .map(bnd => [bnd.MatePosition, bnd]),
    ).get(`${feat2.get('refName')}:${feat2.get('start') + 1}`)
  }
  return undefined
}

// Returns paired BND features across multiple views by inspecting
// the ALT field to get exact coordinate matches
export function getMatchedBreakendFeatures(feats: Map<string, Feature>) {
  const candidates = new Map<string, Feature[]>()
  const alreadySeen = new Set<string>()

  for (const f of feats.values()) {
    if (!alreadySeen.has(f.id())) {
      if (f.get('type') === 'breakend') {
        const alts = f.get('ALT') as string[] | undefined
        alts?.forEach(a => {
          const cur = `${f.get('refName')}:${f.get('start') + 1}`
          const bnd = parseBreakend(a)
          if (bnd) {
            const val = candidates.get(cur)
            if (!val) {
              candidates.set(bnd.MatePosition || 'none', [f])
            } else {
              val.push(f)
            }
          }
        })
      }
    }
    alreadySeen.add(f.id())
  }

  return [...candidates.values()].filter(v => v.length > 1)
}

// Getting "matched" TRA means just return all TRA
export function getMatchedTranslocationFeatures(feats: Map<string, Feature>) {
  const ret: Feature[][] = []
  const alreadySeen = new Set<string>()

  for (const f of feats.values()) {
    if (!alreadySeen.has(f.id()) && f.get('ALT')[0] === '<TRA>') {
      ret.push([f])
    }
    alreadySeen.add(f.id())
  }

  return ret
}
