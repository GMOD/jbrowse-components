import { fetchRegionRaws } from './fetchRegionRaws.ts'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

// Two regions fetched at once share the track's one status line; the first to
// finish clearing it would blank the message the other is still showing.
test('concurrent region fetches each get their own status line', async () => {
  const callbacks: unknown[] = []
  const adapter = {
    getFeaturesArray: jest.fn((_region, opts: { statusCallback: unknown }) => {
      callbacks.push(opts.statusCallback)
      return Promise.resolve([])
    }),
  } as unknown as BaseFeatureDataAdapter
  const region = (start: number) => ({
    refName: 'chr1',
    start,
    end: start + 100,
    assemblyName: 'hg38',
  })
  await fetchRegionRaws(adapter, [region(0), region(1000)], {
    statusCallback: () => {},
  })
  expect(callbacks).toHaveLength(2)
  expect(callbacks[0]).not.toBe(callbacks[1])
})
