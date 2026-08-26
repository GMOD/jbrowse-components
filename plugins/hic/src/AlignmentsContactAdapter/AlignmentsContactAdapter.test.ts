import { SimpleFeature } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import AlignmentsContactAdapter from './AlignmentsContactAdapter.ts'
import configSchema from './configSchema.ts'

import type { ContactChannel } from './contactChannels.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

const RES = 750
const PAIRED = 0x1
const REVERSE = 0x10
const MATE_REVERSE = 0x20
const FIRST_IN_PAIR = 0x40

function region(start: number, end: number, refName = '7'): Region {
  return { refName, start, end, assemblyName: 'test' }
}

/** One read, spelled the way a BAM feature arrives. */
function read(
  uniqueId: string,
  start: number,
  fields: Partial<SimpleFeatureSerialized> = {},
) {
  return new SimpleFeature({
    uniqueId,
    refName: '7',
    start,
    end: start + 148,
    strand: 1,
    flags: PAIRED | FIRST_IN_PAIR | MATE_REVERSE,
    ...fields,
  })
}

function makeAdapter(reads: SimpleFeature[], conf: Record<string, unknown>) {
  const subadapter = {
    setSequenceAdapterConfig: () => {},
    getRefNames: () => Promise.resolve(['7']),
    getFeatures: (r: Region) =>
      ObservableCreate<SimpleFeature>(observer => {
        for (const feature of reads) {
          if (
            feature.get('refName') === r.refName &&
            feature.get('end') > r.start &&
            feature.get('start') < r.end
          ) {
            observer.next(feature)
          }
        }
        observer.complete()
      }),
  }
  const getSubAdapter = (() =>
    Promise.resolve({
      dataAdapter: subadapter,
      sessionIds: new Set(['test']),
    })) as unknown as getSubAdapterType

  return new AlignmentsContactAdapter(
    configSchema.create({
      type: 'AlignmentsContactAdapter',
      subadapter: { type: 'BamAdapter' },
      ...conf,
    }) as AnyConfigurationModel,
    getSubAdapter,
  )
}

async function cells(
  reads: SimpleFeature[],
  channel: ContactChannel,
  regions = [region(0, 30000)],
  conf: Record<string, unknown> = {},
) {
  const adapter = makeAdapter(reads, { channel, ...conf })
  const out = await adapter.getMultiRegionContactRecords(regions, {
    resolution: RES,
  })
  return {
    out,
    list: [...out.bin1].map((bin1, i) => ({
      bin1,
      bin2: out.bin2[i]!,
      counts: out.counts[i]!,
    })),
  }
}

test('the header offers the configured bin sizes, unnormalized', async () => {
  const adapter = makeAdapter([], { binSizes: [5000, 750] })
  expect(await adapter.getHeader()).toEqual({
    norms: ['NONE'],
    resolutions: [750, 5000],
  })
})

test('refNames come from the subadapter', async () => {
  expect(await makeAdapter([], {}).getRefNames()).toEqual(['7'])
})

test('a proper pair inside minSpan produces no discordant contact', async () => {
  const { out } = await cells(
    [read('a', 1000, { next_ref: '7', next_pos: 1300 })],
    'discordant',
  )
  expect(out.numContacts).toBe(0)
  expect(out.pairs).toEqual([])
})

test('a pair 10kb apart is one discordant contact in the right bins', async () => {
  const { out, list } = await cells(
    [read('a', 1000, { next_ref: '7', next_pos: 11000 })],
    'discordant',
  )
  expect(list).toEqual([{ bin1: 1, bin2: 14, counts: 1 }])
  expect(out.pairs).toEqual([
    { region1Idx: 0, region2Idx: 0, start: 0, end: 1 },
  ])
  expect(out.resolution).toBe(RES)
  expect(out.appliedNormalization).toBe('NONE')
})

test('both mates in view still make one contact', async () => {
  const { out } = await cells(
    [
      read('a', 1000, { next_ref: '7', next_pos: 11000 }),
      read('a2', 11000, {
        next_ref: '7',
        next_pos: 1000,
        strand: -1,
        flags: PAIRED | REVERSE,
      }),
    ],
    'discordant',
  )
  expect(out.numContacts).toBe(1)
  expect(out.counts[0]).toBe(1)
})

test('pairs landing in one cell sum their counts', async () => {
  const { list } = await cells(
    [
      read('a', 1000, { next_ref: '7', next_pos: 11000 }),
      read('b', 1100, { next_ref: '7', next_pos: 11100 }),
    ],
    'discordant',
  )
  expect(list).toEqual([{ bin1: 1, bin2: 14, counts: 2 }])
})

test('a same-strand pair shows on sameStrand and nowhere else', async () => {
  const ll = [
    read('a', 1000, {
      next_ref: '7',
      next_pos: 20000,
      flags: PAIRED | FIRST_IN_PAIR,
    }),
  ]
  expect((await cells(ll, 'sameStrand')).list).toEqual([
    { bin1: 1, bin2: 26, counts: 1 },
  ])
  expect((await cells(ll, 'outward')).out.numContacts).toBe(0)
})

test('sameStrand drops a pair sharing one bin', async () => {
  const { out } = await cells(
    [
      read('a', 1000, {
        next_ref: '7',
        next_pos: 1200,
        flags: PAIRED | FIRST_IN_PAIR,
      }),
    ],
    'sameStrand',
  )
  expect(out.numContacts).toBe(0)
})

test('an everted pair shows on outward', async () => {
  const { list } = await cells(
    [read('a', 20000, { next_ref: '7', next_pos: 1000 })],
    'outward',
  )
  expect(list).toEqual([{ bin1: 1, bin2: 26, counts: 1 }])
})

test('an SA split segment is a discordant contact', async () => {
  const { list } = await cells(
    [
      read('a', 1000, {
        next_ref: '7',
        next_pos: 1300,
        tags: { SA: '7,20001,+,100S48M,60,0;' },
      }),
    ],
    'discordant',
  )
  expect(list).toEqual([{ bin1: 1, bin2: 26, counts: 1 }])
})

test('depthDifference is the absolute depth gap of every bin pair', async () => {
  // Three 750bp bins holding 3, 1 and 1 reads, by read midpoint.
  const reads = [
    read('a1', 100),
    read('a2', 200),
    read('a3', 300),
    read('b1', 900),
    read('c1', 1600),
  ]
  const { list, out } = await cells(reads, 'depthDifference', [region(0, 2250)])
  expect(out.resolution).toBe(RES)
  expect(list).toEqual([
    { bin1: 0, bin2: 1, counts: 2 },
    { bin1: 0, bin2: 2, counts: 2 },
  ])
})

test('depthDifference steps to a coarser bin size on a wide view', async () => {
  const { out } = await cells([read('a', 1000)], 'depthDifference', [
    region(0, 40_000_000),
  ])
  expect(out.resolution).toBe(25000)
})

test('a contact whose mate lies outside every region is dropped', async () => {
  const { out } = await cells(
    [read('a', 1000, { next_ref: '7', next_pos: 900_000 })],
    'discordant',
    [region(0, 30000)],
  )
  expect(out.numContacts).toBe(0)
})

test('two regions put a spanning contact on their own run', async () => {
  const { out } = await cells(
    [read('a', 1000, { next_ref: '7', next_pos: 60000 })],
    'discordant',
    [region(0, 30000), region(50000, 80000)],
  )
  expect(out.pairs).toEqual([
    { region1Idx: 0, region2Idx: 1, start: 0, end: 1 },
  ])
  expect([out.bin1[0], out.bin2[0]]).toEqual([1, 80])
})
