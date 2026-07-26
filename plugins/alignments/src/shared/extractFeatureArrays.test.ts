import { SimpleFeature } from '@jbrowse/core/util'

import { extractFeatureArrays } from './extractFeatureArrays.ts'

import type { ColorBy } from './types.ts'
import type { FeatureData } from './webglRpcTypes.ts'
import type { Feature, Region } from '@jbrowse/core/util'

const region: Region = {
  refName: 'ctgA',
  start: 0,
  end: 50000,
  assemblyName: 'volvox',
}

// Shaped after the SyntenyFeature the PAF/PIF adapters emit (see
// comparative-adapters' util.ts): a `mate` naming this block's position in the
// other assembly, a CIGAR string, and no forEachMismatch.
function syntenyFeature(refName: string, mateRefName: string) {
  return new SimpleFeature({
    uniqueId: `${refName}-${mateRefName}`,
    refName,
    start: 100,
    end: 200,
    strand: 1,
    type: 'match',
    CIGAR: '100M',
    mate: {
      refName: mateRefName,
      start: 300,
      end: 400,
      assemblyName: 'volvox_random',
    },
  })
}

function bamRead(nextRef: string) {
  return new SimpleFeature({
    uniqueId: `read-${nextRef}`,
    refName: 'ctgA',
    start: 100,
    end: 200,
    strand: 1,
    next_ref: nextRef,
  })
}

const buildFeatureData = (f: Feature): FeatureData => ({
  id: f.id(),
  name: '',
  start: f.get('start'),
  end: f.get('end'),
  flags: 0,
  mapq: 0,
  insertSize: 0,
  pairOrientation: 0,
  strand: f.get('strand') ?? 0,
})

function extract(features: Feature[], colorBy: ColorBy) {
  return extractFeatureArrays(features, buildFeatureData, {
    colorBy,
    showSoftClipping: false,
    region,
  })
}

describe('mateRefName extraction', () => {
  test('a synteny block reports the refName it aligns to in the other assembly', () => {
    expect(
      extract(
        [syntenyFeature('ctgA', 'ctgB'), syntenyFeature('ctgA', 'ctgC')],
        { type: 'mateRefName' },
      ).tagColorValues,
    ).toEqual(['ctgB', 'ctgC'])
  })

  test('a BAM read falls back to its mate reference', () => {
    expect(
      extract([bamRead('ctgB')], { type: 'mateRefName' }).tagColorValues,
    ).toEqual(['ctgB'])
  })

  test('a feature with neither mate nor next_ref reports no name', () => {
    expect(
      extract([bamRead('')], { type: 'mateRefName' }).tagColorValues,
    ).toEqual([''])
  })

  // The channel is shared with tag coloring, so it must stay empty for every
  // other scheme — a stray value would bake a color over the shader's own.
  test('the channel is empty under other color schemes', () => {
    expect(
      extract([syntenyFeature('ctgA', 'ctgB')], { type: 'strand' })
        .tagColorValues,
    ).toEqual([])
  })

  // The main thread turns uniqueTagValues into colorTagMap, which is the
  // legend's swatch list — reporting them only for tag coloring left chromosome
  // painting with no legend at all.
  test('distinct names are reported for the legend, skipping the mateless ones', () => {
    expect(
      extract(
        [
          syntenyFeature('ctgA', 'ctgB'),
          syntenyFeature('ctgA', 'ctgB'),
          syntenyFeature('ctgA', 'ctgC'),
          bamRead(''),
        ],
        { type: 'mateRefName' },
      ).uniqueTagValues,
    ).toEqual(['ctgB', 'ctgC'])
  })

  test('no names are reported under other color schemes', () => {
    expect(
      extract([syntenyFeature('ctgA', 'ctgB')], { type: 'strand' })
        .uniqueTagValues,
    ).toBeUndefined()
  })
})

// A feature with a CIGAR but no forEachMismatch — a PAF/PIF synteny block, or a
// BED of graph alleles read by an AlignmentsTrack — used to contribute no indels
// at all, so an assembly alignment drew as one flat block and its insertions
// were invisible. Locks the contract both of those displays now depend on.
describe('CIGAR-only features', () => {
  function alleleFeature(cigar: string) {
    return new SimpleFeature({
      uniqueId: `allele-${cigar}`,
      refName: 'ctgA',
      start: 1000,
      end: 1100,
      strand: 1,
      type: 'match',
      CIGAR: cigar,
    })
  }

  test('an insertion is extracted at its reference position', () => {
    const { insertions } = extract([alleleFeature('2062M63348I')], {
      type: 'strand',
    })
    expect(insertions).toHaveLength(1)
    expect(insertions[0]!.position).toBe(3062)
    expect(insertions[0]!.length).toBe(63348)
  })

  test('a deletion is extracted as a gap over the reference it skips', () => {
    const { gaps } = extract([alleleFeature('48M3217D')], { type: 'strand' })
    expect(gaps).toHaveLength(1)
    expect(gaps[0]!.start).toBe(1048)
    expect(gaps[0]!.end).toBe(4265)
  })

  test('a plain match contributes nothing', () => {
    const { insertions, gaps } = extract([alleleFeature('100M')], {
      type: 'strand',
    })
    expect(insertions).toHaveLength(0)
    expect(gaps).toHaveLength(0)
  })

  test('a feature with no CIGAR is skipped rather than throwing', () => {
    expect(() => extract([bamRead('')], { type: 'strand' })).not.toThrow()
  })
})
