import { classifyGenotypeDosage } from '../shared/parseGenotypeDosage.ts'
import {
  imputeMissingToSiteMean,
  readAltDosages,
  readPhasedAlleleIndicators,
} from './genotypeMatrixEncoding.ts'

function dosages(genotype: string, numAlts = 1) {
  const out = new Float32Array(numAlts)
  readAltDosages(genotype, 0, genotype.length, out, 0, numAlts)
  return [...out]
}

const dist = (a: number[], b: number[]) =>
  Math.hypot(...a.map((v, i) => v - b[i]!))

describe('readAltDosages', () => {
  // The case that must not move: on diploid biallelic and haploid calls the new
  // encoding agrees to the bit with the 0/1/2 class it replaces, so no existing
  // clustering result over an ordinary VCF changes.
  test.each(['0/0', '0/1', '1/0', '1/1', '0|1', '1|1', '0', '1'])(
    '%s matches the class encoding it replaces',
    genotype => {
      expect(dosages(genotype)[0]).toBe(classifyGenotypeDosage(genotype))
    },
  )

  test.each([
    ['0/0', 0],
    ['0/1', 1],
    ['1/1', 2],
    // haploid is fully alt, not a het: the fraction is ploidy-invariant
    ['0', 0],
    ['1', 2],
    // polyploid no longer collapses onto one "mixed" class
    ['0/0/1', 2 / 3],
    ['0/1/1', 4 / 3],
    ['1/1/1', 2],
    ['0/0/0/1', 0.5],
  ])('biallelic %s -> %p', (genotype, expected) => {
    expect(dosages(genotype)[0]).toBeCloseTo(expected)
  })

  test('only the called alleles count', () => {
    expect(dosages('./1')[0]).toBe(2)
    expect(dosages('0/.')[0]).toBe(0)
    expect(dosages('./1/1')[0]).toBe(2)
    expect(dosages('./0/1')[0]).toBe(1)
  })

  test('a fully uncalled genotype is MISSING in every slot', () => {
    expect(dosages('./.')[0]).toBeNaN()
    expect(dosages('')[0]).toBeNaN()
    expect(dosages('.|.|.', 2)).toEqual([NaN, NaN])
  })

  // The reason a site gets one column per ALT rather than one scalar: a scalar
  // counts non-ref alleles and cannot say *which*, so two homozygotes for
  // different alts were the same point.
  describe('multiallelic', () => {
    test('different alts no longer collapse onto each other', () => {
      expect(dosages('1|1', 2)).toEqual([2, 0])
      expect(dosages('2|2', 2)).toEqual([0, 2])
      expect(dosages('1|2', 2)).toEqual([1, 1])
      expect(dosages('0|2', 2)).toEqual([0, 1])
    })

    test('sharing one allele is closer than sharing none', () => {
      const homAlt1 = dosages('1|1', 2)
      const homAlt2 = dosages('2|2', 2)
      const het12 = dosages('1|2', 2)
      expect(dist(homAlt1, het12)).toBeLessThan(dist(homAlt1, homAlt2))
      expect(dist(homAlt2, het12)).toBeLessThan(dist(homAlt1, homAlt2))
    })

    test('multi-character allele indices are one allele each', () => {
      expect(dosages('0/12', 12)[11]).toBe(1)
      expect(dosages('12/12', 12)[11]).toBe(2)
      expect(dosages('0/12', 12)[0]).toBe(0)
    })

    // A GT naming an allele the ALT column doesn't list is malformed; it must
    // not write out of bounds, but it is still an observed allele so it counts
    // toward the ploidy denominator.
    test('an allele index past the ALT count claims no slot but still counts', () => {
      expect(dosages('1/3', 2)).toEqual([1, 0])
      const out = new Float32Array(3)
      out[2] = 99
      readAltDosages('1/3', 0, 3, out, 0, 2)
      expect(out[2]).toBe(99)
    })
  })

  test('writes at an offset without touching its neighbours', () => {
    const out = new Float32Array(4)
    out[0] = 7
    out[3] = 9
    readAltDosages('1|2', 0, 3, out, 1, 2)
    expect([...out]).toEqual([7, 1, 1, 9])
  })

  test('reads a substring without allocating', () => {
    const out = new Float32Array(1)
    readAltDosages('xx0/1/1yy', 2, 7, out, 0, 1)
    expect(out[0]).toBeCloseTo(4 / 3)
  })
})

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
