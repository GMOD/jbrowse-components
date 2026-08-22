import HicAdapter from './HicAdapter.ts'
import configSchema from './configSchema.ts'

import type { RpcStatus } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

// The one link the mock-based suite cannot cover: what `@gmod/hic` actually
// reports on a real file, run through the adapter's own arithmetic. A pair that
// reported `total` 0, or ticks the adapter divided the wrong way, would reach
// the display as a NaN fraction and read as a broken bar rather than as a
// failure.
const HIC = require.resolve('../../../../extra_test_data/test.hic')

function makeAdapter() {
  return new HicAdapter(
    configSchema.create({
      hicLocation: { localPath: HIC, locationType: 'LocalPathLocation' },
    }),
  )
}

function determinate(statuses: RpcStatus[], message: string) {
  return statuses.filter(
    (s): s is Exclude<RpcStatus, string> =>
      typeof s === 'object' && s.message === message,
  )
}

test('a real single-region fetch reports a real fraction of its one pair', async () => {
  const adapter = makeAdapter()
  const statuses: RpcStatus[] = []
  const regions: Region[] = [
    { assemblyName: 'test', refName: '1', start: 0, end: 249_250_621 },
  ]

  const { numContacts } = await adapter.getMultiRegionContactRecords(regions, {
    resolution: 100_000,
    normalization: 'KR',
    statusCallback: status => {
      statuses.push(status)
    },
  })

  expect(numContacts).toBe(60109)
  const readings = determinate(statuses, 'Downloading data')
  // The opening tick: `@gmod/hic` reports 0 of this pair's blocks before the
  // first read goes out, which is what makes the bar determinate from the start
  // instead of after a round trip. One pair, so the total is 1.
  expect(readings.at(0)).toEqual({
    message: 'Downloading data',
    current: 0,
    total: 1,
  })
  // Six blocks read in a few ms off a local file, and emission is gated at
  // 100ms, so the ticks between are thinned away here — the upstream suite is
  // what pins one per block. What this covers is that every reading the adapter
  // does emit is a real fraction: a pair reporting a total of 0, or ticks
  // divided the wrong way, would arrive as NaN and read as a broken bar rather
  // than as a failure.
  for (const { current, total } of readings) {
    expect(total).toBe(1)
    expect(current).toBeGreaterThanOrEqual(0)
    expect(current).toBeLessThanOrEqual(1)
  }
})

test('a real header read reports the normalization-index walk', async () => {
  const adapter = makeAdapter()
  const statuses: RpcStatus[] = []

  const { norms } = await adapter.getHeader({
    statusCallback: status => {
      statuses.push(status)
    },
  })

  expect(norms).toContain('KR')
  // 8 expected-value chunks in this file: 4 normalization types over its 2
  // resolutions. The walk is what makes opening a pre-v9 file slow, and this is
  // the phase that used to say nothing while it ran.
  expect(determinate(statuses, 'Reading normalization index')).toEqual([
    { message: 'Reading normalization index', current: 0, total: 8 },
    { message: 'Reading normalization index', current: 1, total: 8 },
    { message: 'Reading normalization index', current: 2, total: 8 },
    { message: 'Reading normalization index', current: 3, total: 8 },
    { message: 'Reading normalization index', current: 4, total: 8 },
    { message: 'Reading normalization index', current: 5, total: 8 },
    { message: 'Reading normalization index', current: 6, total: 8 },
    { message: 'Reading normalization index', current: 7, total: 8 },
    { message: 'Reading normalization index', current: 8, total: 8 },
  ])
})
