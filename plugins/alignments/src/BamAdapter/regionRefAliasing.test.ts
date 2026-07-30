import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './BamAdapter.ts'
import configSchema from './configSchema.ts'

import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { Feature } from '@jbrowse/core/util'

// The reference-binding fields under test — structural, so the assertions read
// as "what a fetch handed back" rather than reaching into the record class.
interface RegionView {
  ref?: string
  refOffset: number
  id: () => string
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
  const narrowOffset = first.refOffset

  // Same reads, wider region: seqFetchSpan starts lower, so a correct binding
  // for THIS fetch is a different refOffset than the narrow one above.
  const wide = await fetchRegion(adapter, 19000, 23000)
  const sameRead = new Map(wide.map(f => [f.id(), f])).get(first.id())!

  expect(sameRead.refOffset).not.toBe(narrowOffset)
  // ...and the earlier fetch's feature still describes its own region
  expect(first.refOffset).toBe(narrowOffset)
  expect(first.ref).toBe(narrowRef)
})

test('the same range twice gives each fetch its own binding', async () => {
  const adapter = makeAdapter()
  const a = await fetchRegion(adapter, 20000, 22000)
  const b = await fetchRegion(adapter, 20000, 22000)

  // identical range => identical binding, but not a shared mutable record
  expect(b[0]!.refOffset).toBe(a[0]!.refOffset)
  expect(b[0]!.ref).toBe(a[0]!.ref)
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
    expect(rightById.get(l.id())!.refOffset).not.toBe(l.refOffset)
  }
})
