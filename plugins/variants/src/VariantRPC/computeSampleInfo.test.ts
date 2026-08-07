import { buildSampleIndex, decodeGenotype } from '../shared/genotypeCodec.ts'
import { buildHeaderRemap, computeSampleInfo } from './computeSampleInfo.ts'

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
