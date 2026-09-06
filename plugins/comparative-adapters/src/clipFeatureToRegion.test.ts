import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { ComparativeAdapterBase } from './ComparativeAdapterBase.ts'
import MCScanBlocksAdapter from './MCScanBlocksAdapter/MCScanBlocksAdapter.ts'
import blocksConfigSchema from './MCScanBlocksAdapter/configSchema.ts'
import SyntenyFeature from './SyntenyFeature/index.ts'
import { clipFeatureToRegion } from './clipFeatureToRegion.ts'

import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

// own axis 400 bp (M100 D50 M100 M150), mate axis 400 bp (M100 M100 I50 M150):
// D advances the record's own axis only, I the mate's only
const CIGAR = '100M50D100M50I150M'

function record(extra: Partial<SimpleFeatureSerialized> = {}) {
  return new SyntenyFeature({
    uniqueId: 'r1',
    refName: 'chr1',
    assemblyName: 'anchor',
    start: 1000,
    end: 1400,
    strand: 1,
    syntenyId: 7,
    identity: 0.98,
    numMatches: 350,
    mate: { refName: 'mchr1', assemblyName: 'mate', start: 5000, end: 5400 },
    ...extra,
  })
}

function mateOf(f: Feature) {
  return f.get('mate') as { start: number; end: number; refName: string }
}

function extents(f: Feature) {
  const mate = mateOf(f)
  return [f.get('start'), f.get('end'), mate.start, mate.end]
}

test('+ strand: a deletion straddling the window start is trimmed, an insertion at the window end is kept', () => {
  const inner = clipFeatureToRegion(record({ CIGAR }), {
    start: 1120,
    end: 1300,
  })[0]!
  expect(extents(inner)).toEqual([1120, 1300, 5100, 5300])
  const atInsertion = clipFeatureToRegion(record({ CIGAR }), {
    start: 1120,
    end: 1250,
  })[0]!
  expect(extents(atInsertion)).toEqual([1120, 1250, 5100, 5250])
})

test('− strand: the mate runs from its far end', () => {
  const plus = clipFeatureToRegion(record({ CIGAR }), {
    start: 1000,
    end: 1120,
  })[0]!
  expect(extents(plus)).toEqual([1000, 1120, 5000, 5100])
  const minus = clipFeatureToRegion(record({ CIGAR, strand: -1 }), {
    start: 1000,
    end: 1120,
  })[0]!
  expect(extents(minus)).toEqual([1000, 1120, 5300, 5400])
})

test('a coarse fold clips in proportion along its run', () => {
  const f = clipFeatureToRegion(
    record({
      start: 0,
      end: 1000,
      coarseCigar: '1000:2000M',
      mate: { refName: 'mchr1', assemblyName: 'mate', start: 0, end: 2000 },
    }),
    { start: 250, end: 500 },
  )[0]!
  expect(extents(f)).toEqual([250, 500, 500, 1000])
})

test('no alignment string: linear interpolation of the mate interval, strand honoured', () => {
  const mate = {
    refName: 'mchr1',
    assemblyName: 'mate',
    start: 10000,
    end: 12000,
  }
  const plus = clipFeatureToRegion(record({ start: 0, end: 1000, mate }), {
    start: 250,
    end: 500,
  })[0]!
  expect(extents(plus)).toEqual([250, 500, 10500, 11000])
  const minus = clipFeatureToRegion(
    record({ start: 0, end: 1000, mate, strand: -1 }),
    { start: 250, end: 500 },
  )[0]!
  expect(extents(minus)).toEqual([250, 500, 11000, 11500])
})

test('a record outside the window is dropped', () => {
  expect(
    clipFeatureToRegion(record({ CIGAR }), { start: 2000, end: 3000 }),
  ).toEqual([])
  expect(clipFeatureToRegion(record(), { start: 2000, end: 3000 })).toEqual([])
})

test('the piece keeps every field but the alignment strings, and its ids name the window', () => {
  const f = clipFeatureToRegion(record({ CIGAR, cs: ':100*ac' }), {
    start: 1120,
    end: 1300,
  })[0]!
  expect(f.id()).toBe('r1:1120-1300')
  expect(f.get('syntenyId')).toBe('7:1120-1300')
  expect(f.get('CIGAR')).toBeUndefined()
  expect(f.get('cs')).toBeUndefined()
  expect(f.get('identity')).toBe(0.98)
  expect(f.get('numMatches')).toBe(350)
  expect(f.get('strand')).toBe(1)
  expect(mateOf(f).refName).toBe('mchr1')
  const inside = clipFeatureToRegion(record({ CIGAR }), {
    start: 0,
    end: 5000,
  })[0]!
  expect(extents(inside)).toEqual([1000, 1400, 5000, 5400])
  expect(inside.id()).toBe('r1:0-5000')
  expect(inside.get('CIGAR')).toBeUndefined()
})

test('a feature with no mate is not a pairwise record and passes through', () => {
  const f = new SyntenyFeature({
    uniqueId: 'g',
    refName: 'chr1',
    start: 0,
    end: 10,
  })
  expect(clipFeatureToRegion(f, { start: 2, end: 4 })).toEqual([f])
})

// own axis 1000 + 25000 + 1000 + 200 + 500 bp, mate axis 1000 + 1000 + 500:
// one deletion past the 10 kb bound and one well under it
const GAPPED = '1000M25000D1000M200D500M'

function gapped(extra: Partial<SimpleFeatureSerialized> = {}) {
  return record({
    start: 100_000,
    end: 127_700,
    mate: { refName: 'mchr1', assemblyName: 'mate', start: 5000, end: 7500 },
    CIGAR: GAPPED,
    ...extra,
  })
}

test('splitAtGapBp: a record inside the window is cut at its large indel into runs that share the window suffix and are numbered', () => {
  const window = { start: 0, end: 1_000_000 }
  const runs = clipFeatureToRegion(gapped(), window, 10_000)
  expect(runs.map(extents)).toEqual([
    [100_000, 101_000, 5000, 6000],
    [126_000, 127_700, 6000, 7500],
  ])
  expect(runs.map(f => f.id())).toEqual(['r1:0-1000000/0', 'r1:0-1000000/1'])
  expect(runs.map(f => f.get('syntenyId'))).toEqual([
    '7:0-1000000/0',
    '7:0-1000000/1',
  ])
  expect(runs.every(f => f.get('CIGAR') === undefined)).toBe(true)
  expect(runs.every(f => f.get('identity') === 0.98)).toBe(true)
})

test('splitAtGapBp: a window over one run yields that run alone under the plain suffix, and the bound decides what is a gap', () => {
  const [first, ...rest] = clipFeatureToRegion(
    gapped(),
    { start: 100_500, end: 110_000 },
    10_000,
  )
  expect(rest).toEqual([])
  expect(extents(first!)).toEqual([100_500, 101_000, 5500, 6000])
  expect(first!.id()).toBe('r1:100500-110000')

  const unsplit = clipFeatureToRegion(
    gapped(),
    { start: 0, end: 1_000_000 },
    30_000,
  )
  expect(unsplit.map(extents)).toEqual([[100_000, 127_700, 5000, 7500]])
  expect(unsplit[0]!.id()).toBe('r1:0-1000000')
})

test('splitAtGapBp: - strand runs walk the mate from its far end', () => {
  const runs = clipFeatureToRegion(
    gapped({ strand: -1 }),
    { start: 0, end: 1_000_000 },
    10_000,
  )
  expect(runs.map(extents)).toEqual([
    [100_000, 101_000, 6500, 7500],
    [126_000, 127_700, 5000, 6500],
  ])
  expect(runs.every(f => f.get('strand') === -1)).toBe(true)
})

test('splitAtGapBp: a record with no alignment string is one run', () => {
  expect(
    clipFeatureToRegion(record(), { start: 0, end: 5000 }, 10_000).map(extents),
  ).toEqual([[1000, 1400, 5000, 5400]])
})

const stubConfigSchema = ConfigurationSchema('StubAdapter', {})

class StubAdapter extends ComparativeAdapterBase {
  regionsSeen: BaseOptions[] = []

  async getRefNames() {
    return ['chr1']
  }

  getFeatures(_region: Region, opts: BaseOptions = {}) {
    this.regionsSeen.push(opts)
    return ObservableCreate<Feature>(observer => {
      observer.next(record({ CIGAR }))
      observer.complete()
    })
  }
}

class GapStubAdapter extends StubAdapter {
  override getFeatures(_region: Region, opts: BaseOptions = {}) {
    this.regionsSeen.push(opts)
    return ObservableCreate<Feature>(observer => {
      observer.next(gapped())
      observer.complete()
    })
  }
}

class GenePairStubAdapter extends StubAdapter {
  protected override readonly recordsAreAlignments = false
}

const regions: Region[] = [
  { assemblyName: 'anchor', refName: 'chr1', start: 1000, end: 1200 },
  { assemblyName: 'anchor', refName: 'chr1', start: 1200, end: 1500 },
]

function fetchAll(
  adapter: ComparativeAdapterBase,
  opts: BaseOptions,
  over = regions,
) {
  return firstValueFrom(
    adapter.getFeaturesInMultipleRegions(over, opts).pipe(toArray()),
  )
}

test('the base passes splitAtGapBp to the clip and getFeatures never sees it', async () => {
  const adapter = new GapStubAdapter(stubConfigSchema.create({}))
  const pieces = await fetchAll(
    adapter,
    { clipToRegion: true, splitAtGapBp: 10_000 },
    [{ assemblyName: 'anchor', refName: 'chr1', start: 1500, end: 200_000 }],
  )
  expect(pieces.map(f => f.id()).sort()).toEqual([
    'r1:1500-200000/0',
    'r1:1500-200000/1',
  ])
  expect(
    adapter.regionsSeen.every(
      o => o.clipToRegion === undefined && o.splitAtGapBp === undefined,
    ),
  ).toBe(true)
})

test('two regions over one record yield two distinct pieces, and getFeatures never sees the option', async () => {
  const adapter = new StubAdapter(stubConfigSchema.create({}))
  const pieces = await fetchAll(adapter, { clipToRegion: true })
  expect(pieces.map(f => f.id()).sort()).toEqual([
    'r1:1000-1200',
    'r1:1200-1500',
  ])
  expect(pieces.map(extents).sort((a, b) => a[0]! - b[0]!)).toEqual([
    [1000, 1200, 5000, 5150],
    [1200, 1400, 5150, 5400],
  ])
  expect(adapter.regionsSeen.every(o => o.clipToRegion === undefined)).toBe(
    true,
  )
  const whole = await fetchAll(adapter, {})
  expect(whole.map(f => f.id())).toEqual(['r1', 'r1'])
  expect(whole[0]!.get('CIGAR')).toBe(CIGAR)
})

test('an adapter whose records are gene pairs answers the same with the option as without', async () => {
  const adapter = new GenePairStubAdapter(stubConfigSchema.create({}))
  const clipped = await fetchAll(adapter, { clipToRegion: true })
  const whole = await fetchAll(adapter, {})
  expect(clipped.map(f => f.toJSON())).toEqual(whole.map(f => f.toJSON()))
})

const bed = (f: string) => ({
  localPath: require.resolve(`./MCScanBlocksAdapter/test_data/${f}`),
  locationType: 'LocalPathLocation' as const,
})

test('MCScanBlocksAdapter: a window cutting through a gene returns the gene whole', async () => {
  const adapter = new MCScanBlocksAdapter(
    blocksConfigSchema.create({
      mcscanBlocksLocation: bed('grape.blocks'),
      blockAssemblies: ['grape', 'peach', 'cacao'],
      bedLocations: [bed('grape.bed'), bed('peach.bed'), bed('cacao.bed')],
      assemblyNames: ['grape', 'peach'],
    }),
  )
  const cutting: Region[] = [
    { assemblyName: 'grape', refName: 'chr1', start: 150, end: 350 },
  ]
  const fetch = (opts: BaseOptions) =>
    firstValueFrom(
      adapter.getFeaturesInMultipleRegions(cutting, opts).pipe(toArray()),
    )
  const clipped = await fetch({ clipToRegion: true, mateShape: 'grouped' })
  const whole = await fetch({ mateShape: 'grouped' })
  expect(whole.length).toBeGreaterThan(0)
  expect(clipped.map(f => f.toJSON())).toEqual(whole.map(f => f.toJSON()))
  expect(clipped.map(f => [f.get('start'), f.get('end')])).toEqual([
    [100, 200],
    [300, 400],
  ])
})
