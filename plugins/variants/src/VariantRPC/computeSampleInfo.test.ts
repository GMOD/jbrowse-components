import { buildSampleIndex, decodeGenotype } from '../shared/genotypeCodec.ts'
import {
  buildHeaderRemap,
  computeSampleInfo,
  packGenotypeKey,
} from './computeSampleInfo.ts'

import type { FilteredVariant } from '../shared/minorAlleleFrequencyUtils.ts'
import type { Feature } from '@jbrowse/core/util'

// A feature that reports genotypes the way VcfFeature does: `sampleIdx` is the
// position in ITS OWN header sample list, which is the contract
// `processGenotypes` documents and the thing `computeSampleInfo` has to line its
// canonical order up against. `sampleNames` is passed by reference so features
// sharing a header share the array identity, as one parser's features do.
function makeFeature(
  id: string,
  headerSampleNames: string[],
  genotypes: string[],
): FilteredVariant {
  const feature = {
    id: () => id,
    get: (k: string) =>
      k === 'sampleNames'
        ? headerSampleNames
        : k === 'ALT'
          ? ['A']
          : k === 'REF'
            ? 'G'
            : undefined,
    processGenotypes: (
      cb: (str: string, start: number, end: number, sampleIdx: number) => void,
    ) => {
      // one line, ranges into it — the shape the real callback reports
      const line = genotypes.join('\t')
      let pos = 0
      for (const [idx, gt] of genotypes.entries()) {
        cb(line, pos, pos + gt.length, idx)
        pos += gt.length + 1
      }
    },
    toJSON: () => ({}),
  } as unknown as Feature
  return { feature, mostFrequentAlt: '1' }
}

// Read a feature's codes back the way the client does: by sample NAME, through
// the canonical order the payload shipped.
function decodedFor(
  result: ReturnType<typeof computeSampleInfo>,
  featureId: string,
) {
  const sampleIndex = buildSampleIndex(result.sampleNames)
  const codes = result.featureGenotypeCodes.get(featureId)!
  const out: Record<string, string> = {}
  for (const name of result.sampleNames) {
    const gt = decodeGenotype(result.genotypeDict, sampleIndex, codes, name)
    if (gt !== undefined) {
      out[name] = gt
    }
  }
  return out
}

describe('computeSampleInfo genotype codes', () => {
  it('lines codes up with sample names for one shared header', () => {
    const header = ['S1', 'S2', 'S3']
    const result = computeSampleInfo(
      [
        makeFeature('f1', header, ['0|0', '0|1', '1|1']),
        makeFeature('f2', header, ['1|1', '0|0', '0|1']),
      ],
      new Map(),
    )
    expect(decodedFor(result, 'f1')).toEqual({
      S1: '0|0',
      S2: '0|1',
      S3: '1|1',
    })
    expect(decodedFor(result, 'f2')).toEqual({
      S1: '1|1',
      S2: '0|0',
      S3: '0|1',
    })
  })

  // The case `collectSampleNames` exists for and has to get right. A
  // SplitVcfTabixAdapter opens one file, and so one header, per refName — which
  // is why the canonical order is a union across headers rather than the first
  // feature's list. But `sampleIdx` counts against the feature's OWN header, so
  // the union is only directly indexable while every header agrees with it
  // position for position. Here the second header inserts a sample the first
  // didn't have, so union position != header position for everything after it,
  // and reading `sampleNames[sampleIdx]` names the wrong sample.
  it('attributes genotypes correctly when a later header adds a sample', () => {
    const headerA = ['S1', 'S3']
    const headerB = ['S1', 'S2', 'S3']
    const result = computeSampleInfo(
      [
        makeFeature('fa', headerA, ['0|0', '1|1']),
        makeFeature('fb', headerB, ['0|0', '0|1', '1|1']),
      ],
      new Map(),
    )
    expect(decodedFor(result, 'fa')).toEqual({ S1: '0|0', S3: '1|1' })
    expect(decodedFor(result, 'fb')).toEqual({
      S1: '0|0',
      S2: '0|1',
      S3: '1|1',
    })
  })

  it('attributes genotypes correctly when two headers order samples differently', () => {
    const result = computeSampleInfo(
      [
        makeFeature('fa', ['S1', 'S2'], ['0|0', '1|1']),
        makeFeature('fb', ['S2', 'S1'], ['0|1', '1|1']),
      ],
      new Map(),
    )
    expect(decodedFor(result, 'fa')).toEqual({ S1: '0|0', S2: '1|1' })
    expect(decodedFor(result, 'fb')).toEqual({ S1: '1|1', S2: '0|1' })
  })

  // Ploidy is per sample, so a header mismatch that swapped the columns would
  // also file the wrong ploidy against the wrong sample.
  it('records ploidy against the sample that actually carries it', () => {
    const result = computeSampleInfo(
      [
        makeFeature('fa', ['S1', 'S3'], ['0|0', '1']),
        makeFeature('fb', ['S1', 'S2', 'S3'], ['0|0', '0|1|1', '1']),
      ],
      new Map(),
    )
    expect(result.sampleInfo.S1!.maxPloidy).toBe(2)
    expect(result.sampleInfo.S2!.maxPloidy).toBe(3)
    expect(result.sampleInfo.S3!.maxPloidy).toBe(1)
  })

  // The site memo recognizes a short genotype by a packed int and a long one by
  // a range compare. A site mixing the two is where a wrong answer would show
  // up — the two kinds must not answer for each other, and a triploid site is
  // routine (1000G chrX non-PAR).
  it('interns correctly at a site mixing packable and unpackable genotypes', () => {
    const result = computeSampleInfo(
      [
        makeFeature(
          'f1',
          ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'],
          ['0|0', '0|1|1', '0|0', '0|1|1', '1|1|1', '0|1'],
        ),
      ],
      new Map(),
    )
    expect(decodedFor(result, 'f1')).toEqual({
      S1: '0|0',
      S2: '0|1|1',
      S3: '0|0',
      S4: '0|1|1',
      S5: '1|1|1',
      S6: '0|1',
    })
    expect(result.sampleInfo.S2!.maxPloidy).toBe(3)
    expect(result.sampleInfo.S6!.maxPloidy).toBe(2)
  })

  // Two-digit allele indices are what a decomposed multiallelic site spells,
  // and they push a diploid genotype past four characters.
  it('interns two-digit allele indices, which do not pack', () => {
    const result = computeSampleInfo(
      [
        makeFeature(
          'f1',
          ['S1', 'S2', 'S3', 'S4'],
          ['12|37', '37|12', '12|37', '1|2'],
        ),
      ],
      new Map(),
    )
    expect(decodedFor(result, 'f1')).toEqual({
      S1: '12|37',
      S2: '37|12',
      S3: '12|37',
      S4: '1|2',
    })
    // '12|37' and '37|12' share no packed key and are genuinely distinct
    expect(result.genotypeDict).toEqual(['12|37', '37|12', '1|2'])
  })
})

describe('packGenotypeKey', () => {
  const key = (s: string) => packGenotypeKey(s, 0, s.length)

  it('gives every genotype of four characters or fewer a distinct key', () => {
    const spellings = [
      '0',
      '1',
      '.',
      '0|0',
      '0/0',
      '0|1',
      '1|0',
      '0/1',
      '1/0',
      '1|1',
      './.',
      '.|.',
      '0|.',
      '.|0',
      '9|9',
      '0|10'.slice(0, 4),
      '1|23'.slice(0, 4),
    ]
    const keys = spellings.map(key)
    expect(keys.every(k => k !== 0)).toBe(true)
    expect(new Set(keys).size).toBe(new Set(spellings).size)
  })

  it('declines anything longer than four characters', () => {
    expect(key('0|1|1')).toBe(0)
    expect(key('12|37')).toBe(0)
    expect(key('0/0/0/0')).toBe(0)
  })

  it('declines an empty range', () => {
    expect(key('')).toBe(0)
    expect(packGenotypeKey('0|0', 1, 1)).toBe(0)
  })

  // A code unit above 0xFF would spill out of its byte and could collide with
  // another genotype's key, so it has to decline rather than truncate.
  it('declines a non-ASCII character rather than truncating it', () => {
    expect(key('0|Ā')).toBe(0)
    expect(key('ÿ')).toBe(0)
  })

  // Keys index an Int32Array, so the top bit must stay clear.
  it('keeps keys non-negative for the widest ASCII genotype', () => {
    expect(key('\x7F\x7F\x7F\x7F')).toBeGreaterThan(0)
  })

  it('reads only the given range', () => {
    const line = 'x0|0y'
    expect(packGenotypeKey(line, 1, 4)).toBe(key('0|0'))
  })
})

// The fast path is load-bearing in a function whose whole point is its cost:
// the remap adds one typed-array read per genotype, and genotypes run to 10^8
// on a real panel, so the single-header case has to skip it entirely.
describe('buildHeaderRemap', () => {
  const columnByName = new Map([
    ['S1', 0],
    ['S2', 1],
    ['S3', 2],
  ])

  it('is undefined when the header already agrees with the canonical order', () => {
    expect(buildHeaderRemap(['S1', 'S2', 'S3'], columnByName)).toBeUndefined()
    // a header that is a prefix of the union also agrees position for position
    expect(buildHeaderRemap(['S1', 'S2'], columnByName)).toBeUndefined()
  })

  it('is undefined when there is no header list at all', () => {
    expect(buildHeaderRemap(undefined, columnByName)).toBeUndefined()
  })

  it('maps header position to canonical position when they differ', () => {
    expect(buildHeaderRemap(['S2', 'S1'], columnByName)).toEqual(
      Int32Array.from([1, 0]),
    )
    // the omitted-sample shape: header S1,S3 against a union that has S2 between
    expect(buildHeaderRemap(['S1', 'S3'], columnByName)).toEqual(
      Int32Array.from([0, 2]),
    )
  })

  it('marks a header sample missing from the canonical order as -1', () => {
    expect(buildHeaderRemap(['S1', 'nope'], columnByName)).toEqual(
      Int32Array.from([0, -1]),
    )
  })
})

// A feature with no `processGenotypes`, i.e. the genotypes-Record fallback any
// non-@gmod/vcf adapter takes. The flags have to come out the same on both
// paths — a fetch can mix them.
function makeRecordFeature(
  id: string,
  genotypes: Record<string, string>,
): FilteredVariant {
  const feature = {
    id: () => id,
    get: (k: string) =>
      k === 'genotypes' ? genotypes : k === 'ALT' ? ['A'] : undefined,
    toJSON: () => ({}),
  } as unknown as Feature
  return { feature, mostFrequentAlt: '1' }
}

// `hasPhasedOrHaploid` is what gates the "Phased" rendering-mode entry, and it
// has to answer for the genotypes the painter treats as phased data —
// `isPhasedOrHaploid` in shared/getPhasedColor.ts, which is "carries no `/`".
// `hasPhased` cannot: a pangenome callset is haploid per assembly path and `vg
// deconstruct` writes bare `0`/`1`/`23`, so a whole file that phased mode
// renders correctly contains no `|` at all.
describe('computeSampleInfo phasing flags', () => {
  const flags = (header: string[], genotypes: string[]) =>
    computeSampleInfo([makeFeature('f1', header, genotypes)], new Map())

  it('reports a callset with no `|` anywhere as phased-or-haploid', () => {
    const result = flags(['S1', 'S2'], ['1', '23'])
    expect(result.hasPhased).toBe(false)
    expect(result.hasPhasedOrHaploid).toBe(true)
  })

  it('reports an unphased diploid callset as neither', () => {
    const result = flags(['S1', 'S2'], ['0/1', '1/1'])
    expect(result.hasPhased).toBe(false)
    expect(result.hasPhasedOrHaploid).toBe(false)
  })

  it('takes an uncalled genotype as evidence of neither', () => {
    // A bare '.' is how plenty of files spell a missing diploid call, so
    // counting it as haploid evidence would offer phased mode on any unphased
    // callset with a hole in it. `hasUnphased` already declines './.' for the
    // same reason.
    const result = flags(['S1', 'S2'], ['./.', '.'])
    expect(result.hasPhasedOrHaploid).toBe(false)
    expect(result.hasUnphased).toBe(false)
  })

  it('reports a mixed-ploidy phased file as both', () => {
    // 1000G chrX non-PAR: haploid males beside phased diploid females
    const result = flags(['FEMALE', 'MALE'], ['0|1', '1'])
    expect(result.hasPhased).toBe(true)
    expect(result.hasPhasedOrHaploid).toBe(true)
  })

  it('agrees on the genotypes-Record path', () => {
    expect(
      computeSampleInfo([makeRecordFeature('f1', { S1: '1' })], new Map())
        .hasPhasedOrHaploid,
    ).toBe(true)
    expect(
      computeSampleInfo([makeRecordFeature('f1', { S1: '0/1' })], new Map())
        .hasPhasedOrHaploid,
    ).toBe(false)
  })
})
