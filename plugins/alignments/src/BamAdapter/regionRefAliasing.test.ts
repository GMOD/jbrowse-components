import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './BamAdapter.ts'
import configSchema from './configSchema.ts'

import type { PackedReference } from '@gmod/bam'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'

// The reference-binding fields under test — structural, so the assertions read
// as "what a fetch handed back" rather than reaching into the record class.
interface RegionView {
  // a packed region carries its own start, which is what identifies the fetch
  // a read was bound to
  ref?: PackedReference
  id: () => string
  get: (field: string) => unknown
  // duck-typed by modifications-utils' getTag(); see the surface test below
  getTag?: (tag: string) => unknown
}

// Synthetic reference: base at p is 'ACGT'[p % 4], so any slice is well-defined
// at any coordinate without shipping a matching FASTA.
function refSlice(start: number, end: number) {
  let s = ''
  for (let i = start; i < end; i++) {
    s += 'ACGT'[i % 4]
  }
  return s
}

class TestSequenceAdapter extends BaseSequenceAdapter {
  constructor() {
    super(ConfigurationSchema('empty', {}).create())
  }
  async getRefNames() {
    return ['1']
  }
  async getRegions() {
    return [{ refName: '1', start: 0, end: 249250621 }]
  }
  getFeatures({ start, end }: { refName: string; start: number; end: number }) {
    return ObservableCreate<Feature>(observer => {
      observer.next(
        new SimpleFeature({
          uniqueId: `1-${start}-${end}`,
          refName: '1',
          start,
          end,
          seq: refSlice(start, end),
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

// extended_cigar.bam carries no MD tags, so its reads take the branch that binds
// a fetched reference slice — the one this test is about. Its reads are ~10kb
// PacBio CCS starting at ~10001, so they span every region queried below.
function makeAdapter() {
  const adapter = new Adapter(
    configSchema.create({
      bamLocation: {
        localPath: require.resolve('../../test_data/extended_cigar.bam'),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: require.resolve('../../test_data/extended_cigar.bam.bai'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
    getSequenceSubAdapter,
  )
  adapter.setSequenceAdapterConfig({ type: 'TestSequenceAdapter' })
  return adapter
}

async function fetchRegion(adapter: Adapter, start: number, end: number) {
  const feats = await firstValueFrom(
    adapter
      .getFeatures({ assemblyName: 'test', refName: '1', start, end })
      .pipe(toArray()),
  )
  return feats as unknown as RegionView[]
}

// @gmod/bam memoizes decoded records in a per-file chunk LRU, so two queries
// resolving to the same chunk span hand back the IDENTICAL record objects.
// Binding a region's reference slice therefore has to produce a per-fetch view;
// writing onto the record let a later fetch rebind the read for an earlier one,
// which then resolved its mismatches against the wrong region's sequence.
//
// Two different query ranges usually produce different chunk keys, so the cache
// misses and each fetch decodes its own copy — which is why this hid for so
// long. Re-querying one range is what forces the cache to actually hit.
test('a refetch does not rebind the reference of an earlier fetch', async () => {
  const adapter = makeAdapter()

  const narrow = await fetchRegion(adapter, 20000, 22000)
  const first = narrow[0]!
  const narrowRef = first.ref
  const narrowStart = first.ref!.start

  // Same reads, wider region: seqFetchSpan starts lower, so a correct binding
  // for THIS fetch is a different region than the narrow one above.
  const wide = await fetchRegion(adapter, 19000, 23000)
  const sameRead = new Map(wide.map(f => [f.id(), f])).get(first.id())!

  expect(sameRead.ref!.start).not.toBe(narrowStart)
  // ...and the earlier fetch's feature still describes its own region
  expect(first.ref!.start).toBe(narrowStart)
  expect(first.ref).toBe(narrowRef)
})

test('the same range twice gives each fetch its own binding', async () => {
  const adapter = makeAdapter()
  const a = await fetchRegion(adapter, 20000, 22000)
  const b = await fetchRegion(adapter, 20000, 22000)

  // identical range => identical binding, but not a shared mutable record
  expect(b[0]!.ref!.start).toBe(a[0]!.ref!.start)
  expect(b[0]!.ref).toEqual(a[0]!.ref)
  expect(b[0]).not.toBe(a[0])
  expect(b[0]!.id()).toBe(a[0]!.id())
})

test('parallel region fetches each get their own reference slice', async () => {
  const adapter = makeAdapter()
  const [left, right] = await Promise.all([
    fetchRegion(adapter, 10000, 12000),
    fetchRegion(adapter, 14000, 16000),
  ])
  const rightById = new Map(right.map(f => [f.id(), f]))
  const shared = left.filter(f => rightById.has(f.id()))
  expect(shared.length).toBeGreaterThan(0)
  for (const l of shared) {
    expect(rightById.get(l.id())!.ref!.start).not.toBe(l.ref!.start)
  }
})

// A reference-bound read is a wrapper around the cached record, so it has to
// re-expose the surface the pipeline uses. Two members degrade SILENTLY if the
// wrapper drops them, which is why they get their own assertions rather than
// being left to the `Feature` type:
//
//   - `getTag` is duck-typed by modifications-utils' getTag(). Absent, that
//     helper still "works" by falling back to `get('tags')` — which decodes
//     every tag on the read to answer one, on the hot path.
//   - `get('mismatches')` depends on the binding, so forwarding it to the
//     unbound record would quietly return mismatches resolved against nothing.
test('a reference-bound read keeps the surface the pipeline relies on', async () => {
  const adapter = makeAdapter()
  const feats = await fetchRegion(adapter, 20000, 22000)
  const f = feats[0]!

  // it really is bound (otherwise the assertions below prove nothing)
  expect(f.ref).toBeDefined()

  expect(typeof f.getTag).toBe('function')
  const tags = f.get('tags') as Record<string, unknown>
  const [someTag] = Object.keys(tags)
  expect(someTag).toBeDefined()
  expect(f.getTag!(someTag!)).toEqual(tags[someTag!])

  // extended_cigar.bam has no MD, so mismatches can only come from the bound
  // reference — an unbound record would report none
  const mismatches = f.get('mismatches') as unknown[]
  expect(mismatches.length).toBeGreaterThan(0)

  // fields routed straight through still answer (a dropped one reads undefined)
  expect(typeof f.get('start')).toBe('number')
  expect(f.get('refName')).toBe('1')
  expect(typeof f.get('CIGAR')).toBe('string')
  expect(typeof f.get('flags')).toBe('number')
  expect((f.get('NUMERIC_CIGAR') as ArrayLike<number>).length).toBeGreaterThan(
    0,
  )
})
