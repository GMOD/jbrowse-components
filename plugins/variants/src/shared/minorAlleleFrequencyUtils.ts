import { checkStopToken2 } from '@jbrowse/core/util/stopToken'

import type VcfFeature from '../VcfFeature/index.ts'
import type { Feature, LastStopTokenCheck } from '@jbrowse/core/util'

const GENOTYPE_SPLIT_REGEX = /[/|]/
const SLASH = 47
const PIPE = 124

/**
 * Count alleles using the fast processGenotypes callback API.
 * Avoids creating intermediate genotypes object.
 */
export function calculateAlleleCountsFast(
  feature: VcfFeature,
): Record<string, number> {
  let count0 = 0
  let count1 = 0
  let count2 = 0
  let count3 = 0
  let countDot = 0
  const otherCounts = {} as Record<string, number>

  feature.processGenotypes((str, start, end) => {
    const len = end - start

    if (len === 3) {
      const sep = str.charCodeAt(start + 1)
      if (sep === SLASH || sep === PIPE) {
        const c0 = str.charCodeAt(start)
        const c1 = str.charCodeAt(start + 2)

        // 48='0', 49='1', 50='2', 51='3', 46='.'
        if (c0 === 48) {
          count0++
        } else if (c0 === 49) {
          count1++
        } else if (c0 === 50) {
          count2++
        } else if (c0 === 51) {
          count3++
        } else if (c0 === 46) {
          countDot++
        } else {
          const a0 = str[start]!
          otherCounts[a0] = (otherCounts[a0] || 0) + 1
        }

        if (c1 === 48) {
          count0++
        } else if (c1 === 49) {
          count1++
        } else if (c1 === 50) {
          count2++
        } else if (c1 === 51) {
          count3++
        } else if (c1 === 46) {
          countDot++
        } else {
          const a1 = str[start + 2]!
          otherCounts[a1] = (otherCounts[a1] || 0) + 1
        }
        return
      }
    }

    if (len === 1) {
      const c = str.charCodeAt(start)
      if (c === 48) {
        count0++
      } else if (c === 49) {
        count1++
      } else if (c === 50) {
        count2++
      } else if (c === 51) {
        count3++
      } else if (c === 46) {
        countDot++
      } else {
        const a = str[start]!
        otherCounts[a] = (otherCounts[a] || 0) + 1
      }
      return
    }

    // General case: polyploid or multi-digit alleles
    const gt = str.slice(start, end)
    const alleles = gt.split(GENOTYPE_SPLIT_REGEX)
    for (const allele of alleles) {
      if (allele === '0') {
        count0++
      } else if (allele === '1') {
        count1++
      } else if (allele === '2') {
        count2++
      } else if (allele === '3') {
        count3++
      } else if (allele === '.') {
        countDot++
      } else {
        otherCounts[allele] = (otherCounts[allele] || 0) + 1
      }
    }
  })

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

/**
 * Count alleles from a genotypes object (fallback for non-VCF features)
 */
export function calculateAlleleCounts(
  genotypes: Record<string, string>,
  cacheSplit: Record<string, string[]>,
) {
  let count0 = 0
  let count1 = 0
  let count2 = 0
  let count3 = 0
  let countDot = 0
  const otherCounts = {} as Record<string, number>

  for (const key in genotypes) {
    const genotype = genotypes[key]!
    const len = genotype.length

    if (len === 3) {
      const sep = genotype[1]
      if (sep === '/' || sep === '|') {
        const a0 = genotype[0]!
        const a1 = genotype[2]!

        if (a0 === '0') {
          count0++
        } else if (a0 === '1') {
          count1++
        } else if (a0 === '2') {
          count2++
        } else if (a0 === '3') {
          count3++
        } else if (a0 === '.') {
          countDot++
        } else {
          otherCounts[a0] = (otherCounts[a0] || 0) + 1
        }

        if (a1 === '0') {
          count0++
        } else if (a1 === '1') {
          count1++
        } else if (a1 === '2') {
          count2++
        } else if (a1 === '3') {
          count3++
        } else if (a1 === '.') {
          countDot++
        } else {
          otherCounts[a1] = (otherCounts[a1] || 0) + 1
        }
        continue
      }
    }

    if (len === 1) {
      if (genotype === '0') {
        count0++
      } else if (genotype === '1') {
        count1++
      } else if (genotype === '2') {
        count2++
      } else if (genotype === '3') {
        count3++
      } else if (genotype === '.') {
        countDot++
      } else {
        otherCounts[genotype] = (otherCounts[genotype] || 0) + 1
      }
      continue
    }

    // General case: polyploid or multi-digit alleles - use cache
    let alleles = cacheSplit[genotype]
    if (!alleles) {
      alleles = genotype.split(GENOTYPE_SPLIT_REGEX)
      cacheSplit[genotype] = alleles
    }
    for (const allele of alleles) {
      if (allele === '0') {
        count0++
      } else if (allele === '1') {
        count1++
      } else if (allele === '2') {
        count2++
      } else if (allele === '3') {
        count3++
      } else if (allele === '.') {
        countDot++
      } else {
        otherCounts[allele] = (otherCounts[allele] || 0) + 1
      }
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

export function calculateMinorAlleleFrequency(
  alleleCounts: Record<string, number>,
) {
  let firstMax = 0
  let secondMax = 0
  let total = 0
  for (const key in alleleCounts) {
    const count = alleleCounts[key]!
    total += count
    if (count > firstMax) {
      secondMax = firstMax
      firstMax = count
    } else if (count > secondMax) {
      secondMax = count
    }
  }
  return secondMax / (total || 1)
}

function getMostFrequentAlt(alleleCounts: Record<string, number>) {
  let mostFrequentAlt
  let max = 0
  for (const alt in alleleCounts) {
    const altCount = alleleCounts[alt]!
    if (alt !== '.' && alt !== '0' && altCount > max) {
      mostFrequentAlt = alt
      max = altCount
    }
  }
  return mostFrequentAlt
}

export interface MAFFilteredFeature {
  feature: Feature
  mostFrequentAlt: string
  alleleCounts: Record<string, number>
}

export function getFeaturesThatPassMinorAlleleFrequencyFilter({
  features,
  minorAlleleFrequencyFilter,
  lengthCutoffFilter,
  stopTokenCheck,
  genotypesCache,
  splitCache = {},
}: {
  features: Iterable<Feature>
  minorAlleleFrequencyFilter: number
  lengthCutoffFilter: number
  stopTokenCheck?: LastStopTokenCheck
  genotypesCache?: Map<string, Record<string, string>>
  splitCache?: Record<string, string[]>
}) {
  const results: MAFFilteredFeature[] = []

  for (const feature of features) {
    if (feature.get('end') - feature.get('start') <= lengthCutoffFilter) {
      let alleleCounts: Record<string, number>

      // Use fast path if feature has processGenotypes (VcfFeature)
      if ('processGenotypes' in feature) {
        alleleCounts = calculateAlleleCountsFast(feature as VcfFeature)
      } else {
        const featureId = feature.id()
        let genotypes = genotypesCache?.get(featureId)
        if (!genotypes) {
          genotypes = feature.get('genotypes') as Record<string, string>
          genotypesCache?.set(featureId, genotypes)
        }
        alleleCounts = calculateAlleleCounts(genotypes, splitCache)
      }

      if (
        calculateMinorAlleleFrequency(alleleCounts) >=
        minorAlleleFrequencyFilter
      ) {
        results.push({
          feature,
          mostFrequentAlt: getMostFrequentAlt(alleleCounts)!,
          alleleCounts,
        })
      }
    }
    checkStopToken2(stopTokenCheck)
  }

  return results
}
