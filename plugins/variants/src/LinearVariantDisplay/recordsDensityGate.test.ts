import { TOO_MANY_FEATURES_REASON } from '@jbrowse/display-kit/regionTooLargeUtils'
import { waitFor } from '@testing-library/react'

import { cellDataOf } from '../shared/cellDataFixtures.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { GetCellDataArgs } from '../VariantRPC/types.ts'

// 5,000 records over 50 kb: at 62.5 bp/px, 6.25 per pixel against the
// default budget of one.
const RECORDS = 5000
const REGION = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 50_000,
}

// The worker's rule: refuse when a region's records per pixel pass the budget
// it was sent, and count either way.
function cellDataWorker(args: GetCellDataArgs) {
  const recordCounts = args.regions.map(() => RECORDS)
  const tooDense = args.regions.some(
    r =>
      args.maxFeatureDensity !== undefined &&
      args.bpPerPx !== undefined &&
      RECORDS / ((r.end - r.start) / args.bpPerPx) > args.maxFeatureDensity,
  )
  return tooDense
    ? { regionTooLarge: true, featureCount: RECORDS, recordCounts }
    : cellDataOf({ recordCounts })
}

async function displayOverDenseWindow(
  displayConfig: Record<string, unknown>,
  samples: { name: string }[],
) {
  jest.useFakeTimers()
  const env = createTestEnvironment({ displayConfig }).createDisplay()
  const cellCalls: GetCellDataArgs[] = []
  env.mockRpcCall.mockImplementation(
    (_sid: string, method: string, args: GetCellDataArgs) => {
      if (method === 'MultiSampleVariantGetCellData') {
        cellCalls.push(args)
      }
      return Promise.resolve(
        method === 'MultiSampleVariantGetSources'
          ? { sources: samples, warnings: [] }
          : method === 'MultiSampleVariantGetCellData'
            ? cellDataWorker(args)
            : [],
      )
    },
  )
  env.view.setDisplayedRegions([REGION])
  env.view.zoomTo(62.5)
  await settle()
  return { ...env, cellCalls }
}

async function settle() {
  jest.advanceTimersByTime(1000)
  await jest.runAllTimersAsync()
}

afterEach(() => {
  jest.useRealTimers()
})

describe.each([
  ['a VCF with no samples', {}, []],
  ['genotypes.show off', { genotypes: { show: false } }, [{ name: 'HG001' }]],
])('records only, %s', (_, displayConfig, samples) => {
  test('a dense window is refused with the too-many-features banner', async () => {
    const { display, cellCalls } = await displayOverDenseWindow(
      displayConfig,
      samples,
    )
    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    expect(display.recordsOnly).toBe(true)
    expect(display.regionTooLargeReason).toBe(TOO_MANY_FEATURES_REASON)
    expect(display.zoomCanReleaseGate).toBe(true)
    expect(cellCalls.at(-1)).toMatchObject({ maxFeatureDensity: 1 })
    expect(display.cellData).toBeUndefined()
  })

  test('Force load fetches without a budget and draws', async () => {
    const { display, cellCalls } = await displayOverDenseWindow(
      displayConfig,
      samples,
    )
    await waitFor(() => {
      expect(display.regionTooLarge).toBe(true)
    })
    display.forceLoad()
    await settle()
    await waitFor(() => {
      expect(display.cellData).toBeDefined()
    })
    expect(display.regionTooLarge).toBe(false)
    expect(cellCalls.at(-1)!.maxFeatureDensity).toBeUndefined()
  })
})

test('records.maxFeatureScreenDensity is the budget', async () => {
  const { display, cellCalls } = await displayOverDenseWindow(
    { genotypes: { show: false }, records: { maxFeatureScreenDensity: 10 } },
    [],
  )
  await waitFor(() => {
    expect(display.cellData).toBeDefined()
  })
  expect(cellCalls.at(-1)).toMatchObject({ maxFeatureDensity: 10 })
  expect(display.regionTooLarge).toBe(false)

  display.configuration.records.setSlot('maxFeatureScreenDensity', 5)
  expect(display.regionTooLarge).toBe(true)
})

test('over genotype rows the density gate never applies', async () => {
  const { display, cellCalls } = await displayOverDenseWindow({}, [
    { name: 'HG001' },
  ])
  await waitFor(() => {
    expect(display.cellData).toBeDefined()
  })
  expect(display.recordsOnly).toBe(false)
  expect(cellCalls.at(-1)!.maxFeatureDensity).toBeUndefined()
  expect(display.densityStatsPerRegion.get(0)?.featureCount).toBe(RECORDS)
  expect(display.densityGateActive).toBe(false)
  expect(display.regionTooLarge).toBe(false)
})
