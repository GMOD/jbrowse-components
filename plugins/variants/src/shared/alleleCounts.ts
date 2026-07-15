import { GENOTYPE_SPLITTER } from './constants.ts'

import type VcfFeature from '../VcfFeature/index.ts'

// Genotype string -> allele-count utilities. Two variants exist on purpose,
// each tuned to its execution context, NOT accidental duplication:
//
// - calculateAlleleCountsFast runs inside the processGenotypes callback and
//   accumulates into an object (`b`) because a closure mutating captured
//   primitives would force a V8 Context allocation on the hottest path.
// - calculateAlleleCounts is a plain for-loop, so it uses local-variable
//   counters (faster than object-property increments).
//
// Don't "DRY" these into one shared buckets/helper: the per-allele indirection
// and the wrong accumulator shape regress the per-feature x per-sample loop.

const SLASH = 47
const PIPE = 124

interface AlleleBuckets {
  count0: number
  count1: number
  count2: number
  count3: number
  countDot: number
  otherCounts: Record<string, number>
}

function countStringAllele(allele: string, b: AlleleBuckets) {
  if (allele === '0') {
    b.count0++
  } else if (allele === '1') {
    b.count1++
  } else if (allele === '2') {
    b.count2++
  } else if (allele === '3') {
    b.count3++
  } else if (allele === '.') {
    b.countDot++
  } else {
    b.otherCounts[allele] = (b.otherCounts[allele] ?? 0) + 1
  }
}

function buildAlleleCounts(
  count0: number,
  count1: number,
  count2: number,
  count3: number,
  countDot: number,
  otherCounts: Record<string, number>,
) {
  const result: Record<string, number> = {}
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
 * Count alleles using the fast processGenotypes callback API.
 * Avoids creating intermediate genotypes object.
 */
export function calculateAlleleCountsFast(
  feature: VcfFeature,
): Record<string, number> {
  const b: AlleleBuckets = {
    count0: 0,
    count1: 0,
    count2: 0,
    count3: 0,
    countDot: 0,
    otherCounts: {},
  }

  feature.processGenotypes((str, start, end) => {
    const len = end - start

    if (len === 3) {
      const sep = str.charCodeAt(start + 1)
      if (sep === SLASH || sep === PIPE) {
        const c0 = str.charCodeAt(start)
        const c1 = str.charCodeAt(start + 2)

        // 48='0', 49='1', 50='2', 51='3', 46='.'
        if (c0 === 48) {
          b.count0++
        } else if (c0 === 49) {
          b.count1++
        } else if (c0 === 50) {
          b.count2++
        } else if (c0 === 51) {
          b.count3++
        } else if (c0 === 46) {
          b.countDot++
        } else {
          const a0 = str[start]!
          b.otherCounts[a0] = (b.otherCounts[a0] ?? 0) + 1
        }

        if (c1 === 48) {
          b.count0++
        } else if (c1 === 49) {
          b.count1++
        } else if (c1 === 50) {
          b.count2++
        } else if (c1 === 51) {
          b.count3++
        } else if (c1 === 46) {
          b.countDot++
        } else {
          const a1 = str[start + 2]!
          b.otherCounts[a1] = (b.otherCounts[a1] ?? 0) + 1
        }
        return
      }
    }

    if (len === 1) {
      const c = str.charCodeAt(start)
      if (c === 48) {
        b.count0++
      } else if (c === 49) {
        b.count1++
      } else if (c === 50) {
        b.count2++
      } else if (c === 51) {
        b.count3++
      } else if (c === 46) {
        b.countDot++
      } else {
        const a = str[start]!
        b.otherCounts[a] = (b.otherCounts[a] ?? 0) + 1
      }
      return
    }

    // General case: polyploid or multi-digit alleles
    const alleles = str.slice(start, end).split(GENOTYPE_SPLITTER)
    for (const allele of alleles) {
      countStringAllele(allele, b)
    }
  })

  return buildAlleleCounts(
    b.count0,
    b.count1,
    b.count2,
    b.count3,
    b.countDot,
    b.otherCounts,
  )
}

/**
 * Count alleles from a genotypes object (fallback for non-VCF features)
 */
export function calculateAlleleCounts(genotypes: Record<string, string>) {
  let count0 = 0
  let count1 = 0
  let count2 = 0
  let count3 = 0
  let countDot = 0
  const otherCounts: Record<string, number> = {}

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
          otherCounts[a0] = (otherCounts[a0] ?? 0) + 1
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
          otherCounts[a1] = (otherCounts[a1] ?? 0) + 1
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
        otherCounts[genotype] = (otherCounts[genotype] ?? 0) + 1
      }
      continue
    }

    // General case: polyploid or multi-digit alleles
    for (const allele of genotype.split(GENOTYPE_SPLITTER)) {
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
        otherCounts[allele] = (otherCounts[allele] ?? 0) + 1
      }
    }
  }

  return buildAlleleCounts(
    count0,
    count1,
    count2,
    count3,
    countDot,
    otherCounts,
  )
}
