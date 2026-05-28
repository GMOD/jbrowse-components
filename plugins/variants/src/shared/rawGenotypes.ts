import { set1 } from '@jbrowse/core/ui/colors'

import { REFERENCE_COLOR, UNPHASED_COLOR } from './constants.ts'

import type { Feature } from '@jbrowse/core/util'

export function getRawCallGenotype(feature: Feature) {
  return feature.get('callGenotype') as Int8Array | undefined
}

// Fast-path diploid genotype split. The 3-char form "a|b" hits on the vast
// majority of human VCFs; the general `split('|')` branch handles polyploid
// or multi-digit allele indices ("10|0").
export function splitPhasedAlleles(genotype: string) {
  return genotype.length === 3
    ? [genotype[0]!, genotype[2]!]
    : genotype.split('|')
}

export function buildSampleIndexMap(sampleNames: string[]) {
  const map = new Map<string, number>()
  for (const [i, sampleName] of sampleNames.entries()) {
    map.set(sampleName, i)
  }
  return map
}

export function detectRawMode(features: { feature: Feature }[]) {
  const first = features[0]?.feature
  if (!first) {
    return undefined
  }
  const callGenotype = first.get('callGenotype') as Int8Array | undefined
  if (!callGenotype) {
    return undefined
  }
  const sampleNames = first.get('sampleNames') as string[]
  return {
    sampleNames,
    sampleIndexMap: buildSampleIndexMap(sampleNames),
  }
}

export function encodeGenotypeFromRaw(
  callGenotype: Int8Array,
  sampleIdx: number,
  ploidy: number,
) {
  let nonRef = 0
  let uncalled = 0
  let total = 0
  const offset = sampleIdx * ploidy
  for (let pi = 0; pi < ploidy; pi++) {
    const a = callGenotype[offset + pi]!
    if (a === -2) {
      continue
    }
    total++
    if (a === -1) {
      uncalled++
    } else if (a !== 0) {
      nonRef++
    }
  }
  if (total === 0 || uncalled === total) {
    return -1
  }
  if (nonRef === 0) {
    return 0
  }
  // Compare against total (not total-uncalled) to match classifyGenotypeDosage:
  // "./1" → nonRef=1, total=2 → het(1). Using total-uncalled would give
  // hom-alt(2), diverging from the string-genotype code path.
  return nonRef === total ? 2 : 1
}

export function getPhasedColorFromRaw(
  allele: number,
  mostFrequentAlt: number,
  PS?: string,
  drawReference = true,
) {
  if (allele > 0) {
    if (PS !== undefined) {
      return `hsl(${+PS % 255}, 50%, 50%)`
    }
    return set1[allele === mostFrequentAlt ? 0 : 1] ?? UNPHASED_COLOR
  }
  return allele === 0 && drawReference ? REFERENCE_COLOR : undefined
}

export function genotypeStringFromRaw(
  callGenotype: Int8Array,
  sampleIdx: number,
  ploidy: number,
  callGenotypePhased?: Uint8Array,
) {
  const phased = callGenotypePhased
    ? Boolean(callGenotypePhased[sampleIdx])
    : false
  const sep = phased ? '|' : '/'
  const parts: string[] = []
  const offset = sampleIdx * ploidy
  for (let pi = 0; pi < ploidy; pi++) {
    const a = callGenotype[offset + pi]!
    if (a === -2) {
      continue
    }
    parts.push(a === -1 ? '.' : String(a))
  }
  return parts.join(sep)
}
