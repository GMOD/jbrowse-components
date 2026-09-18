import { waitFor } from '@testing-library/react'
import { autorun } from 'mobx'

import { createTestEnvironment } from './testEnv.ts'

// Matrix columns are the features of exactly the span on screen, so a zoom that
// stays inside the fetched span leaves it covered and still has to refetch. The
// fetch records the zoom it was issued at, and `regionHasData` refuses the
// payload at any other one.

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const EMPTY_MATRIX = {
  mode: 'matrix',
  sampleInfo: {},
  rowNames: [],
  hasPhased: false,
  hasPhasedOrHaploid: false,
  hasSecondaryAlt: false,
  hasUnphased: false,
  hasNoCall: false,
  paintedDomain: [],
  hasConsequence: false,
  hasSvType: false,
  hasPhaseSet: false,
  svTypeColors: {},
  simplifiedFeatures: [],
  genotypeDict: [],
  sampleNames: ['HG001'],
  cellFeatureIndices: new Float32Array(),
  cellRowIndices: new Uint32Array(),
  cellColors: new Uint32Array(),
  numCells: 0,
  refCellCount: 0,
  numFeatures: 0,
  featureData: [],
  paintedCategories: 0,
}

test('a zoom inside the fetched span refetches the matrix', async () => {
  const { createDisplay } = createTestEnvironment()
  const { display, view, mockRpcCall } = createDisplay()
  mockRpcCall.mockImplementation((_sid: string, method: string) =>
    method === 'MultiSampleVariantGetSources'
      ? Promise.resolve({ sources: [{ name: 'HG001' }], warnings: [] })
      : method === 'MultiSampleVariantGetCellData'
        ? Promise.resolve(EMPTY_MATRIX)
        : Promise.resolve([]),
  )
  const cellDataCalls = () =>
    mockRpcCall.mock.calls.filter(
      ([, method]) => method === 'MultiSampleVariantGetCellData',
    ).length
  view.setDisplayedRegions([
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50_000 },
  ])
  view.zoomTo(20)

  jest.advanceTimersByTime(1000)
  await jest.runAllTimersAsync()
  await waitFor(() => {
    expect(display.dataCurrent).toBe(true)
  })
  expect(display.cellDataBpPerPx).toBe(view.bpPerPx)
  const before = cellDataCalls()

  view.zoomTo(10)
  expect(display.viewportWithinLoadedData).toBe(true)
  expect(display.dataCurrent).toBe(false)

  jest.advanceTimersByTime(1000)
  await jest.runAllTimersAsync()
  await waitFor(() => {
    expect(cellDataCalls()).toBeGreaterThan(before)
  })
  await waitFor(() => {
    expect(display.dataCurrent).toBe(true)
  })
})

// The batch's payload and the span it marks loaded land in one transaction. A
// pan while the zoom's refetch is in flight leaves the view inside the older,
// wider span but off the one the refetch asked for, so the payload alone reads
// as current there until the span lands beside it.
test('the export gate never opens between a payload and its span', async () => {
  const { createDisplay } = createTestEnvironment()
  const { display, view, mockRpcCall } = createDisplay()
  const pending: ((result: unknown) => void)[] = []
  let deferCellData = false
  mockRpcCall.mockImplementation((_sid: string, method: string) =>
    method === 'MultiSampleVariantGetSources'
      ? Promise.resolve({ sources: [{ name: 'HG001' }], warnings: [] })
      : method === 'MultiSampleVariantGetCellData'
        ? deferCellData
          ? new Promise(resolve => pending.push(resolve))
          : Promise.resolve(EMPTY_MATRIX)
        : Promise.resolve([]),
  )
  view.setDisplayedRegions([
    { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 50_000 },
  ])
  view.zoomTo(20)
  jest.advanceTimersByTime(1000)
  await jest.runAllTimersAsync()
  await waitFor(() => {
    expect(display.dataCurrent).toBe(true)
  })

  deferCellData = true
  view.zoomTo(10)
  jest.advanceTimersByTime(1000)
  await jest.runAllTimersAsync()
  await waitFor(() => {
    expect(pending).toHaveLength(1)
  })
  view.horizontalScroll(100)
  expect(display.viewportWithinLoadedData).toBe(true)

  const seen: boolean[] = []
  const stop = autorun(() => {
    seen.push(display.dataCurrent)
  })
  pending[0]!(EMPTY_MATRIX)
  jest.advanceTimersByTime(1000)
  await jest.runAllTimersAsync()
  stop()

  expect(display.cellDataBpPerPx).toBe(view.bpPerPx)
  expect(seen).not.toContain(true)
})
