import { NO_DATA_FOR_RESOLUTION } from '@gmod/hic'
import { isAbortException } from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'

import HicAdapter from './HicAdapter.ts'
import configSchema from './configSchema.ts'

import type { Region } from '@jbrowse/core/util/types'

const metadata = {
  chromosomes: [
    { name: '1', size: 1000000, index: 1 },
    { name: '2', size: 1000000, index: 2 },
  ],
  resolutions: [100000],
}

// `@gmod/hic` hands back struct-of-arrays plus the two things only it can answer:
// which normalization it actually applied, and whether it transposed the query.
// Spell one contact out readably.
function oneContact(
  bin1: number,
  bin2: number,
  counts: number,
  {
    appliedNormalization = 'NONE',
    transposed = false,
  }: { appliedNormalization?: string; transposed?: boolean } = {},
) {
  return {
    records: {
      bin1: Int32Array.of(bin1),
      bin2: Int32Array.of(bin2),
      counts: Float32Array.of(counts),
    },
    appliedNormalization,
    transposed,
  }
}

function noContacts({ appliedNormalization = 'NONE' } = {}) {
  return {
    records: {
      bin1: new Int32Array(0),
      bin2: new Int32Array(0),
      counts: new Float32Array(0),
    },
    appliedNormalization,
    transposed: false,
  }
}

// Mock parser whose inter-chromosomal query throws (mirrors `@gmod/hic` throwing
// when a chr-pair matrix lacks the requested resolution), while intra-chrom
// queries succeed.
function makeMockParser() {
  return {
    getMetaData: () => Promise.resolve(metadata),
    getNormalizationOptions: () => Promise.resolve(['NONE']),
    getContactRecords: (
      _norm: string,
      ref: { chr: string },
      ref2: { chr: string },
    ) => {
      if (ref.chr !== ref2.chr) {
        throw new Error(`${NO_DATA_FOR_RESOLUTION}: map ${ref.chr}-${ref2.chr}`)
      }
      return Promise.resolve(oneContact(0, 0, 5))
    },
  }
}

// The slice of `@gmod/hic` the adapter actually calls, spelled out so the stubs
// below are checked against it rather than typed through `never[]`/`unknown`.
interface MockParser {
  getMetaData: () => Promise<typeof metadata>
  getNormalizationOptions: () => Promise<string[]>
  getContactRecords: (
    norm: string,
    ref: { chr: string },
    ref2: { chr: string },
  ) => Promise<ReturnType<typeof oneContact>>
}

function makeAdapter(hic: MockParser) {
  const adapter = new HicAdapter(
    configSchema.create({
      hicLocation: { uri: 'test.hic', locationType: 'UriLocation' },
    }),
  )
  ;(adapter as unknown as { hic: MockParser }).hic = hic
  return adapter
}

test('a missing inter-chromosomal pair does not fail the whole multi-region fetch', async () => {
  const adapter = makeAdapter(makeMockParser())
  const regions: Region[] = [
    { assemblyName: 'test', refName: '1', start: 0, end: 1000000 },
    { assemblyName: 'test', refName: '2', start: 0, end: 1000000 },
  ]

  const { numContacts, pairs } = await adapter.getMultiRegionContactRecords(
    regions,
    { resolution: 100000, normalization: 'NONE' },
  )

  // both intra-chromosomal pairs (0,0) and (1,1) survive; the throwing inter
  // pair (0,1) contributes nothing instead of aborting the fetch
  expect(numContacts).toBe(2)
  expect(pairs).toEqual([
    { region1Idx: 0, region2Idx: 0, start: 0, end: 1 },
    { region1Idx: 1, region2Idx: 1, start: 1, end: 2 },
  ])
})

test('an already-stopped stopToken aborts the multi-region fetch', async () => {
  const adapter = makeAdapter(makeMockParser())
  const regions: Region[] = [
    { assemblyName: 'test', refName: '1', start: 0, end: 1000000 },
    { assemblyName: 'test', refName: '2', start: 0, end: 1000000 },
  ]
  const stopToken = createStopToken()
  stopStopToken(stopToken)

  const err = await adapter
    .getMultiRegionContactRecords(regions, {
      resolution: 100000,
      normalization: 'NONE',
      stopToken,
    })
    .then(() => undefined)
    .catch((e: unknown) => e)
  expect(err).toBeDefined()
  expect(isAbortException(err)).toBe(true)
})

test('un-swaps bin1/bin2 when the parser transposed the query', async () => {
  // region1 is the higher-index chromosome, so the parser transposes and returns
  // bins along the swapped axis, saying so in `transposed`; the adapter must
  // un-swap so bin1 maps back to region1.
  const adapter = makeAdapter({
    getMetaData: () => Promise.resolve(metadata),
    getNormalizationOptions: () => Promise.resolve(['NONE']),
    getContactRecords: () =>
      Promise.resolve(oneContact(7, 3, 9, { transposed: true })),
  })
  const regions: Region[] = [
    { assemblyName: 'test', refName: '2', start: 0, end: 1000000 },
    { assemblyName: 'test', refName: '1', start: 0, end: 1000000 },
  ]

  const { bin1, bin2, counts, pairs } =
    await adapter.getMultiRegionContactRecords(regions, {
      resolution: 100000,
      normalization: 'NONE',
    })

  const interPair = pairs.find(p => p.region1Idx === 0 && p.region2Idx === 1)
  expect(interPair).toBeDefined()
  const at = interPair!.start
  expect(interPair!.end - at).toBe(1)
  // bin1 maps back to region1 ('2', the higher-index chr) despite the transpose
  expect([bin1[at], bin2[at], counts[at]]).toEqual([3, 7, 9])
})

// Normalization vectors are stored per (type, chr, unit, binsize), so a pair
// that carries no contacts at this binsize routinely also carries no vector and
// reports NONE. It has no data on screen to describe, so it must not be what the
// track menu ticks.
test('an empty pair does not downgrade the reported normalization', async () => {
  const adapter = makeAdapter({
    getMetaData: () => Promise.resolve(metadata),
    getNormalizationOptions: () => Promise.resolve(['NONE', 'KR']),
    getContactRecords: (_norm, ref, ref2) =>
      Promise.resolve(
        ref.chr === ref2.chr
          ? oneContact(0, 0, 5, { appliedNormalization: 'KR' })
          : noContacts(),
      ),
  })
  const regions: Region[] = [
    { assemblyName: 'test', refName: '1', start: 0, end: 1000000 },
    { assemblyName: 'test', refName: '2', start: 0, end: 1000000 },
  ]

  const { numContacts, appliedNormalization } =
    await adapter.getMultiRegionContactRecords(regions, {
      resolution: 100000,
      normalization: 'KR',
    })

  expect(numContacts).toBe(2)
  expect(appliedNormalization).toBe('KR')
})

// But a pair that did contribute contacts still speaks: partial coverage is a
// real state, and the display must not claim a normalization only some of the
// matrix received.
test('a non-empty pair that fell back does downgrade the reported normalization', async () => {
  const adapter = makeAdapter({
    getMetaData: () => Promise.resolve(metadata),
    getNormalizationOptions: () => Promise.resolve(['NONE', 'KR']),
    getContactRecords: (_norm, ref, ref2) =>
      Promise.resolve(
        oneContact(0, 0, 5, {
          appliedNormalization: ref.chr === ref2.chr ? 'KR' : 'NONE',
        }),
      ),
  })
  const regions: Region[] = [
    { assemblyName: 'test', refName: '1', start: 0, end: 1000000 },
    { assemblyName: 'test', refName: '2', start: 0, end: 1000000 },
  ]

  const { appliedNormalization } = await adapter.getMultiRegionContactRecords(
    regions,
    { resolution: 100000, normalization: 'KR' },
  )

  expect(appliedNormalization).toBe('NONE')
})
