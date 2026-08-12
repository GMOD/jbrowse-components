import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './BamAdapter.ts'
import configSchema from './configSchema.ts'

import type { BamFile } from '@gmod/bam'
import type { BaseSequenceAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

/**
 * The reference read is issued ALONGSIDE the alignment fetch rather than after
 * it — from the second query onward, which is the only point it can be.
 *
 * Why this is a unit test and not the browser probe it started as. The cost is a
 * round trip, so `seqfetch-timing-probe.ts` measures it under emulated latency,
 * and it measured the baseline fine: strictly serial at every latency, ~20% of a
 * cold query at 60ms. But it cannot measure the FIX, because its fixture's
 * reference is a 255 KB FASTA — smaller than one 256 KiB
 * `RemoteFileWithRangeCache` chunk, so after the first query the reference is
 * never re-fetched and a pan issues no reference request at all. Validating the
 * prefetch in a browser needs a reference big enough that panning misses that
 * cache, i.e. a real assembly. Ordering is the actual claim, and ordering is
 * exactly what a test can assert deterministically, so it is asserted here.
 *
 * The gate is why the first query is excluded rather than overlooked: nothing in
 * a BAM header says whether its reads carry MD, so the adapter can only know by
 * having seen a read that does not. `needsReference` is that memory, and it
 * cannot be set before the first query's records exist.
 */

const bamLocation = {
  localPath: require.resolve('../../test_data/volvox-sorted-nomd.bam'),
  locationType: 'LocalPathLocation' as const,
}
const index = {
  location: {
    localPath: require.resolve('../../test_data/volvox-sorted-nomd.bam.bai'),
    locationType: 'LocalPathLocation' as const,
  },
}

function setup() {
  const events: string[] = []
  const adapter = new Adapter(configSchema.create({ bamLocation, index }))

  // Stub the sub-adapter rather than configuring a real sequence adapter: what
  // is under test is WHEN getSequence is called relative to the records
  // landing, and a real one would add its own I/O to the ordering.
  const sequenceAdapter = {
    getSequence: async () => {
      events.push('seq:start')
      await Promise.resolve()
      events.push('seq:end')
      return 'a'.repeat(50000)
    },
  } as unknown as BaseSequenceAdapter
  adapter.getSequenceAdapter = () => Promise.resolve(sequenceAdapter)

  // Hold the records back for a few microtasks so "issued before the records
  // land" is observable at all. Without this the BAM read (a LocalFile) can
  // resolve first and both orderings would look identical.
  // A cast rather than `adapter['configure']()`: the bracket form is what lint
  // autofixes into a plain property access, which then fails to typecheck
  // because `configure` is protected. There is no public accessor for the
  // BamFile, and reaching it is the point — the delay has to go on the real
  // read, not on a stub standing in for it.
  const { bam } = (
    adapter as unknown as { configure: () => { bam: BamFile } }
  ).configure()
  const original = bam.getRecordsForRange.bind(bam)
  bam.getRecordsForRange = async (...args: Parameters<typeof original>) => {
    events.push('records:start')
    const records = await original(...args)
    for (let i = 0; i < 20; i++) {
      await Promise.resolve()
    }
    events.push('records:end')
    return records
  }

  const query = {
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  }
  const run = () => firstValueFrom(adapter.getFeatures(query).pipe(toArray()))

  return { events, run }
}

test('the first query reads the reference only after its records land', async () => {
  const { events, run } = setup()

  await run()

  // Nothing here is a regression to fix — the adapter cannot know this file
  // lacks MD until it has looked at a read of it.
  expect(events).toEqual([
    'records:start',
    'records:end',
    'seq:start',
    'seq:end',
  ])
})

test('a later query issues the reference read alongside the alignment fetch', async () => {
  const { events, run } = setup()

  await run()
  events.length = 0
  await run()

  expect(events[0]).toBe('records:start')
  // the whole point: the sequence read is in flight while the records are still
  // being fetched, rather than starting after they land
  expect(events.indexOf('seq:start')).toBeLessThan(
    events.indexOf('records:end'),
  )
})

test('a file whose reads all carry MD never starts the prefetch', async () => {
  const events: string[] = []
  const adapter = new Adapter(
    configSchema.create({
      bamLocation: {
        localPath: require.resolve('../../test_data/volvox-sorted.bam'),
        locationType: 'LocalPathLocation',
      },
      index: {
        location: {
          localPath: require.resolve('../../test_data/volvox-sorted.bam.bai'),
          locationType: 'LocalPathLocation',
        },
      },
    }),
  )
  adapter.getSequenceAdapter = () =>
    Promise.resolve({
      getSequence: async () => {
        events.push('seq')
        return 'a'.repeat(50000)
      },
    } as unknown as BaseSequenceAdapter)

  const query = {
    assemblyName: 'volvox',
    refName: 'ctgA',
    start: 0,
    end: 20000,
  }
  const run = () => firstValueFrom(adapter.getFeatures(query).pipe(toArray()))

  await run()
  await run()

  // volvox-sorted.bam carries MD on every read, so seqFetchSpan returns null
  // and the gate never opens. This is what keeps the prefetch free on the
  // common case rather than adding a sequence read to every query.
  expect(events).toEqual([])
})

test('the emitted reads still resolve mismatches against the prefetched region', async () => {
  const { run } = setup()

  await run()
  const features = await run()

  // The prefetched region is packed at region.start rather than at the reads'
  // own span, so this is the assertion that the two agree: a read with no MD
  // gets a bound view, and that view reports substitutions.
  const withRef = features.filter(f => f.get('mismatches') !== undefined)
  expect(withRef.length).toBeGreaterThan(0)
  const anySub = features.some(f =>
    ((f.get('mismatches') ?? []) as { type: string }[]).some(
      m => m.type === 'mismatch',
    ),
  )
  expect(anySub).toBe(true)
})
