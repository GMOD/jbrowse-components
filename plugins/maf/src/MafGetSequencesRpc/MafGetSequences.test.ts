import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'

import MafGetSequences from './MafGetSequences.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

const mockGetFeatureAdapter = jest.fn()
jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: (...args: unknown[]) =>
    mockGetFeatureAdapter(...args) as unknown,
}))

const REGION = { refName: 'chr1', start: 0, end: 100, assemblyName: 'hg38' }

const FEATURE = {
  get: (field: string) =>
    ({
      start: 0,
      seq: 'ACGT',
      alignments: { mm10: { chr: 'chr1', start: 0, seq: 'ACGA' } },
    })[field],
} as unknown as Feature

async function run(bytes: number | undefined, byteLimit?: number) {
  const getFeaturesArray = jest.fn(() => Promise.resolve([FEATURE]))
  mockGetFeatureAdapter.mockResolvedValue({
    getFeaturesArray,
    getRegionByteSize: () => Promise.resolve(bytes),
  })
  const result = await new MafGetSequences({} as PluginManager).execute({
    regions: [REGION],
    adapterConfig: { type: 'MafTabixAdapter' },
    sessionId: 'session-1',
    samples: [{ id: 'mm10', label: 'mm10' }],
    showAllLetters: true,
    byteLimit,
  })
  return { result, getFeaturesArray }
}

// The one MAF read that measured nothing. `getFeaturesArray` pulls the whole
// span, and `processFeaturesToFasta` sizes a Uint8Array per sample from
// `end - start` before it looks at a feature — so a wide window over a deep
// alignment was an unbounded download AND a multi-gigabyte worker allocation.
test('refuses an over-budget region without reading it', async () => {
  const { result, getFeaturesArray } = await run(50_000_000, 1_000_000)
  expect(isRegionRefused(result)).toBe(true)
  expect(getFeaturesArray).not.toHaveBeenCalled()
})

test('reads a region under the budget', async () => {
  const { result, getFeaturesArray } = await run(500, 1_000_000)
  expect(isRegionRefused(result)).toBe(false)
  expect(getFeaturesArray).toHaveBeenCalled()
})

// No budget is the gate declining to act — force-load reaches the worker as an
// absent `byteLimit`, and a widget opened from a force-loaded track still loads.
test('measures nothing without a byteLimit', async () => {
  const { result, getFeaturesArray } = await run(50_000_000)
  expect(isRegionRefused(result)).toBe(false)
  expect(getFeaturesArray).toHaveBeenCalled()
})
