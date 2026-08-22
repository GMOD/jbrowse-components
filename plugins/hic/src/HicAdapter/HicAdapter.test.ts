import { NO_DATA_FOR_RESOLUTION } from '@gmod/hic'
import { isAbortException } from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'

import HicAdapter from './HicAdapter.ts'
import configSchema from './configSchema.ts'

import type { RpcStatus } from '@jbrowse/core/util'
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
  getNormalizationOptions: (opts?: {
    onProgress?: (current: number, total: number) => void
  }) => Promise<string[]>
  getContactRecords: (
    norm: string,
    ref: { chr: string },
    ref2: { chr: string },
    units?: string,
    binsize?: number,
    opts?: { onProgress?: (current: number, total: number) => void },
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

// Locating the normalization-vector index on a pre-v9 file walks the
// expected-value vectors with two sequential range reads per chunk, which is
// the slowest part of opening a `.hic` and used to sit under a bare label.
test('the normalization-index walk reports its chunks', async () => {
  const adapter = makeAdapter({
    getMetaData: () => Promise.resolve(metadata),
    getNormalizationOptions: opts => {
      opts?.onProgress?.(3, 8)
      return Promise.resolve(['NONE'])
    },
    getContactRecords: () => Promise.resolve(oneContact(0, 0, 5)),
  })
  const statuses: RpcStatus[] = []

  await adapter.getHeader({
    statusCallback: status => {
      statuses.push(status)
    },
  })

  expect(statuses).toContainEqual({
    message: 'Reading normalization index',
    current: 3,
    total: 8,
  })
})

// Pairs are the denominator — a whole-genome view is 325 of them, and it is the
// one total known before any read goes out.
test('a multi-pair fetch reports determinate progress', async () => {
  const adapter = makeAdapter(makeMockParser())
  const regions: Region[] = [
    { assemblyName: 'test', refName: '1', start: 0, end: 1000000 },
    { assemblyName: 'test', refName: '2', start: 0, end: 1000000 },
  ]
  const statuses: RpcStatus[] = []

  await adapter.getMultiRegionContactRecords(regions, {
    resolution: 100000,
    normalization: 'NONE',
    statusCallback: status => {
      statuses.push(status)
    },
  })

  // Emission is time-gated at 100ms and the mock resolves instantly, so only the
  // first completion is guaranteed to land — what matters is that the phase is
  // measurable at all, and against the three pairs two regions make.
  expect(
    statuses.filter(
      s => typeof s === 'object' && s.message === 'Downloading data',
    ),
  ).toContainEqual({ message: 'Downloading data', current: 1, total: 3 })
})

// A pair holds many blocks, and its own block ticks are what move the bar
// inside it. That is the whole of a single-region fetch — one pair, which
// without them could only read 0% until it was done.
test('block progress inside a pair moves the bar', async () => {
  const adapter = makeAdapter({
    getMetaData: () => Promise.resolve(metadata),
    getNormalizationOptions: () => Promise.resolve(['NONE']),
    getContactRecords: (_norm, _ref, _ref2, _units, _binsize, opts) => {
      opts?.onProgress?.(1, 4)
      return Promise.resolve(oneContact(0, 0, 5))
    },
  })
  const regions: Region[] = [
    { assemblyName: 'test', refName: '1', start: 0, end: 1000000 },
  ]
  const statuses: RpcStatus[] = []

  await adapter.getMultiRegionContactRecords(regions, {
    resolution: 100000,
    normalization: 'NONE',
    statusCallback: status => {
      statuses.push(status)
    },
  })

  // One of four blocks, on the fetch's only pair: a quarter of the way through.
  expect(statuses).toContainEqual({
    message: 'Downloading data',
    current: 0.25,
    total: 1,
  })
})

// A pair the file has no matrix for reads nothing at all, so nothing but its
// completion can move it off zero — and a fetch that ends below its own total
// reads as stalled.
test('a pair that reads no blocks still completes', async () => {
  const adapter = makeAdapter({
    getMetaData: () => Promise.resolve(metadata),
    getNormalizationOptions: () => Promise.resolve(['NONE']),
    getContactRecords: () => Promise.resolve(noContacts()),
  })
  const regions: Region[] = [
    { assemblyName: 'test', refName: '1', start: 0, end: 1000000 },
  ]
  const statuses: RpcStatus[] = []

  await adapter.getMultiRegionContactRecords(regions, {
    resolution: 100000,
    normalization: 'NONE',
    statusCallback: status => {
      statuses.push(status)
    },
  })

  expect(statuses).toContainEqual({
    message: 'Downloading data',
    current: 1,
    total: 1,
  })
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
