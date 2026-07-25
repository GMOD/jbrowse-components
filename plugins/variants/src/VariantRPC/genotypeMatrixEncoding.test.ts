import {
  imputeMissingToSiteMean,
  readPhasedAlleleIndicators,
} from './genotypeMatrixEncoding.ts'

function readOne(genotype: string, ploidy = 2) {
  const out = new Float32Array(ploidy)
  readPhasedAlleleIndicators(genotype, 0, genotype.length, out, 0, ploidy)
  return [...out]
}

describe('readPhasedAlleleIndicators', () => {
  test.each([
    ['0|0', [0, 0]],
    ['0|1', [0, 1]],
    ['1|0', [1, 0]],
    ['1|1', [1, 1]],
    // any alt is a 1: the raw allele index is a category, not a quantity
    ['1|2', [1, 1]],
    ['0|12', [0, 1]],
    ['12|0', [1, 0]],
  ])('phased %s', (genotype, expected) => {
    expect(readOne(genotype)).toEqual(expected)
  })

  test('an unphased call claims neither haplotype', () => {
    expect(readOne('0/1')).toEqual([NaN, NaN])
    expect(readOne('1/1')).toEqual([NaN, NaN])
    expect(readOne('./.')).toEqual([NaN, NaN])
  })

  test('a partially uncalled phased genotype keeps the called haplotype', () => {
    expect(readOne('.|1')).toEqual([NaN, 1])
    expect(readOne('0|.')).toEqual([0, NaN])
  })

  test('a haploid call fills only the first haplotype', () => {
    expect(readOne('1')).toEqual([1, NaN])
    expect(readOne('0')).toEqual([0, NaN])
  })

  test('an absent genotype is missing everywhere', () => {
    expect(readOne('')).toEqual([NaN, NaN])
  })

  test('reads polyploid genotypes', () => {
    expect(readOne('0|1|1', 3)).toEqual([0, 1, 1])
    // more alleles than the row ploidy: the extras have nowhere to go
    expect(readOne('0|1|1', 2)).toEqual([0, 1])
  })

  test('writes at an offset without touching neighbors', () => {
    const out = new Float32Array([9, 9, 9, 9, 9, 9])
    readPhasedAlleleIndicators('0|1', 0, 3, out, 2, 2)
    expect([...out]).toEqual([9, 9, 0, 1, 9, 9])
  })

  test('reads a genotype embedded in a larger string', () => {
    const line = 'GT:DP\t1|0:30'
    expect(readOne(line.slice(6, 9))).toEqual([1, 0])
    const out = new Float32Array(2)
    readPhasedAlleleIndicators(line, 6, 9, out, 0, 2)
    expect([...out]).toEqual([1, 0])
  })
})

describe('imputeMissingToSiteMean', () => {
  test('replaces a no-call with the mean of the samples that were called', () => {
    const rows = {
      a: new Float32Array([0, 0]),
      b: new Float32Array([2, NaN]),
      c: new Float32Array([NaN, 2]),
    }
    imputeMissingToSiteMean(rows)
    expect([...rows.a]).toEqual([0, 0])
    expect([...rows.b]).toEqual([2, 1])
    expect([...rows.c]).toEqual([1, 2])
  })

  test('a site with no calls at all drops out', () => {
    const rows = {
      a: new Float32Array([NaN, 1]),
      b: new Float32Array([NaN, 1]),
    }
    imputeMissingToSiteMean(rows)
    expect([...rows.a]).toEqual([0, 1])
    expect([...rows.b]).toEqual([0, 1])
  })

  test('leaves a fully called matrix alone', () => {
    const rows = { a: new Float32Array([0, 1, 2]) }
    imputeMissingToSiteMean(rows)
    expect([...rows.a]).toEqual([0, 1, 2])
  })

  test('handles an empty matrix', () => {
    expect(imputeMissingToSiteMean({})).toEqual({})
    const empty = { a: new Float32Array(0) }
    expect(imputeMissingToSiteMean(empty)).toBe(empty)
  })

  test('a no-call no longer sits further away than any real genotype', () => {
    // The regression this exists for: with the old -1 sentinel, the distance
    // from a no-call to a hom-alt (3) exceeded hom-ref to hom-alt (2), so
    // samples clustered by how much data they were missing.
    const rows = {
      homRef: new Float32Array([0]),
      homAlt: new Float32Array([2]),
      noCall: new Float32Array([NaN]),
    }
    imputeMissingToSiteMean(rows)
    const spread = Math.abs(rows.homRef[0]! - rows.homAlt[0]!)
    expect(Math.abs(rows.noCall[0]! - rows.homAlt[0]!)).toBeLessThan(spread)
    expect(Math.abs(rows.noCall[0]! - rows.homRef[0]!)).toBeLessThan(spread)
  })
})
