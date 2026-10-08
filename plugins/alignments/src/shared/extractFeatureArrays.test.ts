import { SimpleFeature } from '@jbrowse/core/util'

import {
  MOD_TYPE_SAMPLE_READS,
  extractFeatureArrays,
} from './extractFeatureArrays.ts'

import type { ReadColorBy } from './types.ts'
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
  start: f.get('start'),
  end: f.get('end'),
  flags: 0,
  mapq: 0,
  insertSize: 0,
  pairOrientation: 0,
  strand: f.get('strand') ?? 0,
})

function extract(features: Feature[], colorBy: ReadColorBy) {
  return extractFeatureArrays(features, buildFeatureData, {
    colorBy,
    showSoftClipping: false,
    region,
    perBaseBinBp: 1,
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
})

// The SA tag walk is UNCONDITIONAL, and this is the test that says so.
//
// It was briefly gated on `readConnections !== 'off'` — 18.1ms of tag-block
// scanning over 153,677 reads, for an array the arc computation was believed to
// be the only reader of. It is not: linked reads and the curved connectors
// read the same tags under settings of their own.
//
// What the gate was really worth is the CLONE, and that survives as the
// `undefined` below: structured clone is priced by object count, so a group with
// no SA anywhere ships one value instead of one empty string per read.
describe('SA tags are extracted whatever the display is drawing', () => {
  function splitRead(id: string, sa: string | undefined) {
    return new SimpleFeature({
      uniqueId: id,
      refName: 'ctgA',
      start: 100,
      end: 200,
      strand: 1,
      tags: sa === undefined ? {} : { SA: sa },
    })
  }

  const SA = 'ctgB,500,+,50M50S,60,0;'

  test('a read carrying one reports it, with no setting asked about', () => {
    expect(
      extract([splitRead('a', SA), splitRead('b', undefined)], {
        type: 'strand',
      }).suppAlignments,
    ).toEqual([SA, ''])
  })

  // The whole of the optimization, and the deep short-read case: 153,677 reads,
  // not one SA tag between them.
  test('a group with none anywhere ships nothing rather than a string per read', () => {
    expect(
      extract([splitRead('a', undefined), splitRead('b', undefined)], {
        type: 'strand',
      }).suppAlignments,
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

// Collapsed introns with padding 0 make each region exactly one exon, so the
// intron touches both edges and overlaps neither; the walk's half-open window
// test dropped it from both and the view drew no sashimi arc at all
describe('an intron that only touches a region edge', () => {
  const spliced = new SimpleFeature({
    uniqueId: 'spliced',
    refName: 'ctgA',
    start: 100,
    end: 1400,
    strand: 1,
    CIGAR: '100M1000N200M',
  })
  const skipsIn = (start: number, end: number) =>
    extractFeatureArrays([spliced], buildFeatureData, {
      colorBy: { type: 'normal' },
      showSoftClipping: false,
      region: { refName: 'ctgA', start, end, assemblyName: 'volvox' },
      perBaseBinBp: 1,
    }).gaps.filter(g => g.type === 'skip')

  test.each([
    ['the donor exon', 100, 200],
    ['the acceptor exon', 1200, 1400],
  ])('is still extracted in %s', (_, start, end) => {
    expect(skipsIn(start, end)).toMatchObject([{ start: 200, end: 1200 }])
  })
})

// A pileup not colored by modifications reads MM off a sample of its reads,
// since the menu wants only which types exist; the layer reads every read
describe('modification type detection', () => {
  const reads = (n: number, mmAt: number) =>
    Array.from(
      { length: n },
      (_, i) =>
        new SimpleFeature({
          uniqueId: `r${i}`,
          refName: 'ctgA',
          start: 100 + i,
          end: 200 + i,
          strand: 1,
          CIGAR: '100M',
          tags: i === mmAt ? { MM: 'C+m,0;' } : {},
        }),
    )
  const detected = (
    features: Feature[],
    baseLayer?: { type: 'modifications' },
  ) =>
    extractFeatureArrays(features, buildFeatureData, {
      colorBy: { type: 'normal' },
      baseLayer,
      showSoftClipping: false,
      region,
      perBaseBinBp: 1,
    }).detectedModifications

  test('a type within the sample is found in any color mode', () => {
    expect([...detected(reads(10, 3))]).toEqual(['m'])
  })

  test('outside the layer, reads past the sample are not scanned', () => {
    const past = reads(MOD_TYPE_SAMPLE_READS + 1, MOD_TYPE_SAMPLE_READS)
    expect([...detected(past)]).toEqual([])
    expect([...detected(past, { type: 'modifications' })]).toEqual(['m'])
  })
})

// A read that says it has no clip at either end is not looked up for SA, since
// every record of a chimeric alignment is clipped; one that says nothing is
describe('the SA lookup', () => {
  class Read extends SimpleFeature {
    clipLengthAtStartOfRead = 0
    hasEndClip: boolean | undefined
    constructor(hasEndClip: boolean | undefined) {
      super({
        uniqueId: 'r',
        refName: 'ctgA',
        start: 100,
        end: 200,
        strand: 1,
        tags: { SA: 'ctgB,500,+,50S50M,60,0;' },
      })
      this.hasEndClip = hasEndClip
    }
    forEachMismatch() {}
  }
  const saOf = (read: Read) =>
    extractFeatureArrays([read], buildFeatureData, {
      colorBy: { type: 'normal' },
      showSoftClipping: false,
      region,
      perBaseBinBp: 1,
    }).suppAlignments

  test.each([
    [true, ['ctgB,500,+,50S50M,60,0;']],
    [undefined, ['ctgB,500,+,50S50M,60,0;']],
    [false, undefined],
  ] as const)('hasEndClip %s', (hasEndClip, expected) => {
    expect(saOf(new Read(hasEndClip))).toEqual(expected)
  })
})
