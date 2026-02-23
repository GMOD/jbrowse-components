import { set1 } from '@jbrowse/core/ui/colors'

import { REFERENCE_COLOR, UNPHASED_COLOR } from './constants.ts'

import type { Feature } from '@jbrowse/core/util'

export function getRawCallGenotype(feature: Feature) {
  return feature.get('callGenotype') as Int8Array | undefined
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
  return {
    sampleNames: first.get('sampleNames') as string[],
    sampleIndexMap: buildSampleIndexMap(first.get('sampleNames') as string[]),
  }
}

export function calculateAlleleCountsFromRaw(callGenotype: Int8Array) {
  let count0 = 0
  let count1 = 0
  let count2 = 0
  let count3 = 0
  let countDot = 0
  const otherCounts = {} as Record<string, number>

  for (const element of callGenotype) {
    const a = element
    if (a === -2) {
      continue
    }
    if (a === 0) {
      count0++
    } else if (a === 1) {
      count1++
    } else if (a === 2) {
      count2++
    } else if (a === 3) {
      count3++
    } else if (a === -1) {
      countDot++
    } else {
      const key = String(a)
      otherCounts[key] = (otherCounts[key] || 0) + 1
    }
  }

  const result = {} as Record<string, number>
  if (count0 > 0) {
    result['0'] = count0
  }
  if (count1 > 0) {
    result['1'] = count1
  }
  if (count2 > 0) {
    result['2'] = count2
  }
  if (count3 > 0) {
    result['3'] = count3
  }
  if (countDot > 0) {
    result['.'] = countDot
  }
  for (const key in otherCounts) {
    result[key] = otherCounts[key]!
  }
  return result
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
  return nonRef === total - uncalled ? 2 : 1
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
