import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { of } from 'rxjs'

import { executeMafAnnotationData } from './executeMafAnnotationData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

const mockGetFeatureAdapter = jest.fn()
jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: (...args: unknown[]) =>
    mockGetFeatureAdapter(...args) as unknown,
}))

const FRAME = {
  get: (field: string) =>
    ({
      start: 10,
      end: 40,
      src: 'mm10',
      frame: 0,
      strand: 1,
      name: 'gene1',
    })[field],
} as unknown as Feature

const REGION = { refName: 'chr1', start: 0, end: 100, assemblyName: 'hg38' }

async function run(bytes: number | undefined, byteLimit?: number) {
  const getFeatures = jest.fn((_region: unknown, _opts?: unknown) => of(FRAME))
  const getRegionByteSize = jest.fn((_regions: unknown, _opts?: unknown) =>
    Promise.resolve(bytes),
  )
  mockGetFeatureAdapter.mockResolvedValue({ getFeatures, getRegionByteSize })
  const statusCallback = jest.fn()
  const result = await executeMafAnnotationData({
    pluginManager: {} as PluginManager,
    args: {
      regions: [REGION],
      adapterConfig: { type: 'BigBedAdapter' },
      sessionId: 'session-1',
      byteLimit,
      statusCallback,
    },
  })
  return { result, getFeatures, getRegionByteSize, statusCallback }
}

// The frames file is one record per CDS exon *per species*, so it grows with
// the span times the species count exactly as the alignment does. The gate is
// inside the read for the same reason both main tiers put it there: the worker
// measures the index it is about to download, in one round trip.
test('refuses an over-budget region without reading it', async () => {
  const { result, getFeatures } = await run(50_000_000, 1_000_000)
  expect(isRegionRefused(result)).toBe(true)
  expect(getFeatures).not.toHaveBeenCalled()
})

test('reads a region under the budget', async () => {
  const { result, getFeatures } = await run(500, 1_000_000)
  expect(isRegionRefused(result)).toBe(false)
  expect(getFeatures).toHaveBeenCalled()
})

// Unmeasurable is not too large: an adapter quoting no index estimate keeps the
// byte axis out of the verdict, the same reading the main gate takes.
test('reads a region the adapter cannot measure', async () => {
  const { result, getFeatures } = await run(undefined, 1_000_000)
  expect(isRegionRefused(result)).toBe(false)
  expect(getFeatures).toHaveBeenCalled()
})

// No budget means the gate may not act at all — force-load reaches here as an
// absent `byteLimit`, and the executor then measures nothing.
test('measures nothing without a byteLimit', async () => {
  const getRegionByteSize = jest.fn()
  mockGetFeatureAdapter.mockResolvedValue({
    getFeatures: () => of(FRAME),
    getRegionByteSize,
  })
  const result = await executeMafAnnotationData({
    pluginManager: {} as PluginManager,
    args: {
      regions: [REGION],
      adapterConfig: { type: 'BigBedAdapter' },
      sessionId: 'session-1',
    },
  })
  expect(getRegionByteSize).not.toHaveBeenCalled()
  expect(isRegionRefused(result)).toBe(false)
})

// Only mafFrames-shaped rows contribute: a plain annotation adapter without a
// `src` species column names no row to draw on.
test('keeps the frame rows that name a species', async () => {
  const { result } = await run(500, 1_000_000)
  expect(isRegionRefused(result)).toBe(false)
  expect('records' in result && result.records).toEqual([
    {
      refName: 'chr1',
      start: 10,
      end: 40,
      src: 'mm10',
      frame: 0,
      strand: 1,
      name: 'gene1',
      nextFramePos: undefined,
    },
  ])
})

// The fan-out gives this branch a status slot of its own, precisely so its
// progress does not clobber the alignment's. Nothing here used to read the
// argument, so the slot it was handed stayed empty for the whole read.
test('reports progress into the slot it was given', async () => {
  const { getFeatures, getRegionByteSize, statusCallback } = await run(
    500,
    1_000_000,
  )
  expect(getRegionByteSize.mock.calls[0]![1]).toMatchObject({ statusCallback })
  expect(getFeatures.mock.calls[0]![1]).toMatchObject({ statusCallback })
})
