import { waitFor } from '@testing-library/react'

import { createTestEnvironment } from './testEnv.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

// A click used to ask the adapter for the whole buffered region — every feature
// on screen re-downloaded to pick one row out of. The packed arrays already say
// where the clicked feature is, so the query is its own span.

const ctgA = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 10_000,
}

function regionData(): MultiRowRegionData {
  return {
    featureStarts: new Uint32Array([100, 4000]),
    featureEnds: new Uint32Array([200, 4000]),
    featureColors: new Uint32Array([0xff0000ff, 0xff00ff00]),
    featureDeltas: new Int32Array(0),
    partitionValues: ['sampleA', 'sampleB'],
    featurePartitionIndex: new Uint32Array([0, 1]),
    featureNames: ['segA', 'segB'],
    featureIds: ['feat1', 'insertion'],
    usedItemRgb: false,
    partitionCandidates: [],
    resolvedPartitionField: 'name',
  }
}

function setup() {
  const { createDisplay } = createTestEnvironment()
  const { display, mockRpcCall } = createDisplay()
  display.setLoadedRegion(0, ctgA)
  display.setRpcData(0, regionData())
  mockRpcCall.mockImplementation((_sessionId: string, method: string) =>
    method === 'GetCanvasFeatureDetails'
      ? {
          feature: { uniqueId: 'feat1', refName: 'ctgA', start: 100, end: 200 },
        }
      : new Promise(() => {}),
  )
  return { display, mockRpcCall }
}

async function detailsArgs(mock: jest.Mock) {
  await waitFor(() => {
    expect(mock.mock.calls.some(c => c[1] === 'GetCanvasFeatureDetails')).toBe(
      true,
    )
  })
  return mock.mock.calls.find(c => c[1] === 'GetCanvasFeatureDetails')![2]
}

test('the details fetch asks for the clicked feature span, not the region', async () => {
  const { display, mockRpcCall } = setup()

  display.selectFeatureById('feat1', 0)

  expect((await detailsArgs(mockRpcCall)).region).toMatchObject({
    refName: 'ctgA',
    start: 100,
    end: 200,
  })
})

test('a zero-length feature is widened to one base, not an empty query', async () => {
  const { display, mockRpcCall } = setup()

  display.selectFeatureById('insertion', 0)

  expect((await detailsArgs(mockRpcCall)).region).toMatchObject({
    start: 4000,
    end: 4001,
  })
})

test('an id the arrays no longer hold falls back to the loaded region', async () => {
  const { display, mockRpcCall } = setup()

  display.selectFeatureById('gone', 0)

  expect((await detailsArgs(mockRpcCall)).region).toMatchObject({
    start: 0,
    end: 10_000,
  })
})
