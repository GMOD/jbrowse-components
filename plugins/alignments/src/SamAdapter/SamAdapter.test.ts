import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './SamAdapter.ts'
import configSchema from './configSchema.ts'

import type SamRecordFeature from './SamRecordFeature.ts'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'

// 40 bases of ctgA starting at 0, so a record's reference is known exactly
const CTGA = 'ACGTACGTACGTACGTACGTACGTACGTACGTACGTACGT'

class TestSequenceAdapter extends BaseSequenceAdapter {
  constructor() {
    super(ConfigurationSchema('empty', {}).create())
  }

  async getRefNames() {
    return ['ctgA']
  }

  async getRegions() {
    return [{ refName: 'ctgA', start: 0, end: CTGA.length }]
  }

  getFeatures({ start, end }: { refName: string; start: number; end: number }) {
    return ObservableCreate<Feature>(observer => {
      observer.next(
        new SimpleFeature({
          uniqueId: `ctgA-${start}-${end}`,
          refName: 'ctgA',
          start,
          end,
          seq: CTGA.slice(start, end),
        }),
      )
      observer.complete()
    })
  }
}

const getSequenceSubAdapter: getSubAdapterType = async () => ({
  dataAdapter: new TestSequenceAdapter(),
  sessionIds: new Set(),
})

const SAM = [
  '@HD\tVN:1.6',
  '@SQ\tSN:ctgA\tLN:40',
  '@SQ\tSN:ctgB\tLN:40',
  // matches the reference exactly over 8 bases
  'exact\t0\tctgA\t1\t60\t8M\t*\t0\t0\tACGTACGT\t*',
  // one substitution at reference offset 2 (ctgA[2] is G, the read says A)
  'snp\t0\tctgA\t1\t60\t8M\t*\t0\t0\tACATACGT\t*',
  // 4M, a 2bp deletion, 4M, then 3 soft-clipped bases. The aligned bases match
  // ctgA[0..4) + ctgA[6..10), so only the structure is reported
  'indel\t16\tctgA\t1\t60\t4M2D4M3S\t*\t0\t0\tACGTGTACAAA\t*',
  'elsewhere\t0\tctgB\t1\t60\t4M\t*\t0\t0\tACGT\t*',
  '',
].join('\n')

function makeAdapter(samText: string) {
  const adapter = new Adapter(
    configSchema.create({ samText }),
    getSequenceSubAdapter,
  )
  adapter.setSequenceAdapterConfig({ type: 'TestSequenceAdapter' })
  return adapter
}

function fetch(adapter: Adapter, refName: string) {
  return firstValueFrom(
    adapter
      .getFeatures({ assemblyName: 'test', refName, start: 0, end: 40 })
      .pipe(toArray()),
  )
}

test('refNames come from the @SQ lines, in header order', async () => {
  expect(await makeAdapter(SAM).getRefNames()).toEqual(['ctgA', 'ctgB'])
})

// a SAM emitted by a converter (or cut from a larger file) often has no header
test('a headerless SAM falls back to the refNames its records name', async () => {
  const adapter = makeAdapter('read\t0\tctgC\t1\t60\t4M\t*\t0\t0\tACGT\t*\n')
  expect(await adapter.getRefNames()).toEqual(['ctgC'])
})

test('serves only the records on the queried reference', async () => {
  const features = await fetch(makeAdapter(SAM), 'ctgA')
  expect(features.map(f => f.get('name'))).toEqual(['exact', 'snp', 'indel'])
})

test('reads coordinates, strand and MAPQ off the record', async () => {
  const [exact, , indel] = await fetch(makeAdapter(SAM), 'ctgA')
  expect(exact!.get('start')).toBe(0)
  expect(exact!.get('end')).toBe(8)
  expect(exact!.get('strand')).toBe(1)
  // BAM/CRAM spell MAPQ `score`, which is what getMappingQuality reads
  expect(exact!.get('score')).toBe(60)
  // 4M2D4M consumes 10 reference bases; the soft clip consumes none
  expect(indel!.get('end')).toBe(10)
  expect(indel!.get('strand')).toBe(-1)
})

// PSL-derived and other MD-less records can only be compared against the
// assembly's sequence, which is the whole reason the adapter loads one
test('calls per-base mismatches against the reference sequence', async () => {
  const [exact, snp] = await fetch(makeAdapter(SAM), 'ctgA')
  expect(exact!.get('mismatches')).toEqual([])
  expect(snp!.get('mismatches')).toEqual([
    { type: 'mismatch', start: 2, length: 1, base: 'A', altbase: 'G' },
  ])
})

// the soft clip sits at the read's end position, which is the right edge of the
// reference span the mismatch walk is bounded by — the adapter's one base of
// slack is what keeps it from being dropped
test('reports the CIGAR indels and clipping', async () => {
  const [, , indel] = await fetch(makeAdapter(SAM), 'ctgA')
  expect(indel!.get('mismatches')).toEqual([
    { type: 'deletion', start: 4, length: 2 },
    { type: 'softclip', start: 10, length: 1, cliplen: 3 },
  ])
})

// the mismatch walk indexes a shared region string by offset, so a record
// starting inside the fetched span has to be located within it. Mismatch starts
// are read-relative, as they are for BAM/CRAM.
test('locates a record that does not start at the region start', async () => {
  const adapter = makeAdapter(
    '@SQ\tSN:ctgA\tLN:40\nmid\t0\tctgA\t5\t60\t4M\t*\t0\t0\tAAGT\t*\n',
  )
  const [mid] = await fetch(adapter, 'ctgA')
  // ctgA[4..8) is ACGT; only the second base differs
  expect(mid!.get('mismatches')).toEqual([
    { type: 'mismatch', start: 1, length: 1, base: 'A', altbase: 'C' },
  ])
})

// an MD tag makes the walk reference-free, and must take precedence
test('uses an MD tag instead of the reference when one is present', async () => {
  const adapter = makeAdapter(
    'md\t0\tctgA\t1\t60\t8M\t*\t0\t0\tACATACGT\t*\tMD:Z:2G5\n',
  )
  const [md] = await fetch(adapter, 'ctgA')
  expect(md!.get('mismatches')).toEqual([
    { type: 'mismatch', start: 2, length: 1, base: 'A', altbase: 'G' },
  ])
})

test('filters by flag, read name and tag', async () => {
  const adapter = makeAdapter(SAM)
  const reverseOnly = await firstValueFrom(
    adapter
      .getFeatures(
        { assemblyName: 'test', refName: 'ctgA', start: 0, end: 40 },
        { filterBy: { flagInclude: 16, flagExclude: 0 } },
      )
      .pipe(toArray()),
  )
  expect(reverseOnly.map(f => f.get('name'))).toEqual(['indel'])

  const named = await firstValueFrom(
    adapter
      .getFeatures(
        { assemblyName: 'test', refName: 'ctgA', start: 0, end: 40 },
        { filterBy: { flagInclude: 0, flagExclude: 0, readName: 'snp' } },
      )
      .pipe(toArray()),
  )
  expect(named.map(f => f.get('name'))).toEqual(['snp'])
})

// an unmapped record has no placement to draw, and RNAME '*' is not a reference
test('drops unplaced records', async () => {
  const adapter = makeAdapter(
    'unmapped\t4\t*\t0\t0\t*\t*\t0\t0\tACGT\t*\nplaced\t0\tctgA\t1\t60\t4M\t*\t0\t0\tACGT\t*\n',
  )
  expect(await adapter.getRefNames()).toEqual(['ctgA'])
  const features = await fetch(adapter, 'ctgA')
  expect(features.map(f => f.get('name'))).toEqual(['placed'])
})

test('ids are stable across fetches, so the same read keys the same row', async () => {
  const adapter = makeAdapter(SAM)
  const ids = (features: Feature[]) => features.map(f => f.id())
  expect(ids(await fetch(adapter, 'ctgA'))).toEqual(
    ids(await fetch(adapter, 'ctgA')),
  )
})

test('exposes the header text it was given', async () => {
  expect(await makeAdapter(SAM).getHeader()).toContain('@SQ\tSN:ctgA\tLN:40')
})

// pair fields drive the pair-orientation color mode and the arcs display
test('resolves pair orientation for a properly paired record', async () => {
  const adapter = makeAdapter('pair\t99\tctgA\t1\t60\t4M\t=\t21\t24\tACGT\t*\n')
  const [pair] = (await fetch(adapter, 'ctgA')) as SamRecordFeature[]
  expect(pair!.get('pair_orientation')).toBe('F1R2')
  expect(pair!.get('next_segment_position')).toBe('ctgA:21')
})

test('leaves pair orientation unset for an unpaired record', async () => {
  const [exact] = await fetch(makeAdapter(SAM), 'ctgA')
  expect(exact!.get('pair_orientation')).toBeUndefined()
})
