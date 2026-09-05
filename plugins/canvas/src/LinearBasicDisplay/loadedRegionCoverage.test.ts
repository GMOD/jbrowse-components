import { waitFor } from '@testing-library/react'

import {
  makeFeatureData,
  makeFlatbushItem,
  packFixtureRects,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

function stampedPayload(region: { start: number; end: number }) {
  return makeFeatureData({
    ...packFixtureRects([{ startBp: region.start, endBp: region.end }]),
    flatbushItems: [
      makeFlatbushItem({
        featureId: `${region.start}-${region.end}`,
        startBp: region.start,
        endBp: region.end,
      }),
    ],
    featureCount: 1,
  })
}

type RenderArgs = {
  region: { start: number; end: number }
  byteLimit?: number
}

function byteGatedRender(bytesPerBp: number) {
  return (_sessionId: string, _method: string, args: RenderArgs) => {
    const { region, byteLimit } = args
    const bytes = Math.round((region.end - region.start) * bytesPerBp)
    return Promise.resolve(
      byteLimit !== undefined && bytes > byteLimit
        ? { regionTooLarge: true as const, bytes }
        : { ...stampedPayload(region), bytes },
    )
  }
}

function densityGatedRender(featuresPerBp: number) {
  return (
    _sessionId: string,
    _method: string,
    args: RenderArgs & { bpPerPx: number; maxFeatureDensity?: number },
  ) => {
    const { region, bpPerPx, maxFeatureDensity } = args
    const featureCount = Math.round((region.end - region.start) * featuresPerBp)
    const perPx = featureCount / ((region.end - region.start) / bpPerPx)
    return Promise.resolve(
      maxFeatureDensity !== undefined && perPx > maxFeatureDensity
        ? { regionTooLarge: true as const, featureCount, bytes: 1000 }
        : { ...stampedPayload(region), featureCount, bytes: 1000 },
    )
  }
}

function heldExtent(display: { rpcDataMap: ReadonlyMap<number, unknown> }) {
  const data = display.rpcDataMap.get(0) as
    | { flatbushItems: { startBp: number; endBp: number }[] }
    | undefined
  const item = data?.flatbushItems[0]
  return item && { start: item.startBp, end: item.endBp }
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

async function settle() {
  jest.advanceTimersByTime(800)
  await jest.runAllTimersAsync()
}

const BYTES_PER_BP = 20

// Every zoom here sits above 100 bp/px, on one side of the gene-glyph `auto`
// threshold, so a refetch off `zoomFetchKey` cannot hide a freeze.
const WARM_BP_PER_PX = 150
const WIDE_BP_PER_PX = 1500
const RELEASED_BP_PER_PX = 400

async function warmedThenRefused(
  render: (s: string, m: string, a: never) => Promise<unknown>,
) {
  const env = createTestEnvironment()
  const { display, view, mockRpcCall } = env.createDisplay()
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 5_000_000, refName: 'ctgA' },
  ])
  mockRpcCall.mockImplementation(render)

  view.zoomTo(WARM_BP_PER_PX)
  await settle()
  await waitFor(() => {
    expect(display.loadedRegions.size).toBe(1)
  })
  const warm = heldExtent(display)!

  view.zoomTo(WIDE_BP_PER_PX)
  await settle()
  await waitFor(() => {
    expect(display.regionTooLarge).toBe(true)
  })

  expect(heldExtent(display)).toEqual(warm)

  return { display, view, mockRpcCall, warm }
}

describe('a region refused for size over data already held', () => {
  it('does not widen the loaded span for a region it never stored', async () => {
    const { display, warm } = await warmedThenRefused(
      byteGatedRender(BYTES_PER_BP),
    )

    expect(display.loadedRegions.get(0)).toMatchObject(warm)
    expect(display.viewportWithinLoadedData).toBe(false)
  })

  it('re-measures on a zoom back into data it already holds', async () => {
    const { display, view, mockRpcCall } = await warmedThenRefused(
      byteGatedRender(BYTES_PER_BP),
    )
    const callsWhileBlocked = mockRpcCall.mock.calls.length

    view.zoomTo(WARM_BP_PER_PX)
    await settle()
    await settle()

    expect(mockRpcCall.mock.calls.length).toBeGreaterThan(callsWhileBlocked)
    expect(display.regionTooLarge).toBe(false)
  })

  it('re-measures once per settled viewport, not in a loop', async () => {
    const { mockRpcCall } = await warmedThenRefused(
      byteGatedRender(BYTES_PER_BP),
    )
    const callsWhileBlocked = mockRpcCall.mock.calls.length

    jest.advanceTimersByTime(5000)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsWhileBlocked)
  })

  it('covers the viewport once density stops gating', async () => {
    const { display, view } = await warmedThenRefused(densityGatedRender(0.002))

    view.zoomTo(RELEASED_BP_PER_PX)
    await settle()
    await settle()

    expect(display.regionTooLarge).toBe(false)
    expect(display.error).toBeUndefined()

    const visible = view.visibleRegions[0]!
    expect(heldExtent(display)!.end).toBeGreaterThanOrEqual(visible.end)
    expect(display.viewportWithinLoadedData).toBe(true)
  })
})

describe('a loaded region with no data behind it', () => {
  it('refetches instead of reading as covered', async () => {
    const env = createTestEnvironment()
    const { display, view, mockRpcCall } = env.createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 5_000_000, refName: 'ctgA' },
    ])
    mockRpcCall.mockImplementation(byteGatedRender(BYTES_PER_BP))
    view.zoomTo(WARM_BP_PER_PX)
    await settle()
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    display.setLoadedRegion(0, view.displayedRegions[0], undefined)
    expect(display.viewportWithinLoadedData).toBe(true)
    expect(display.regionHasData(0)).toBe(false)
    expect(display.isCacheValid(0)).toBe(false)

    const before = mockRpcCall.mock.calls.length
    view.scrollTo(200)
    await settle()
    await settle()

    expect(mockRpcCall.mock.calls.length).toBeGreaterThan(before)
    expect(heldExtent(display)).toBeDefined()
  })
})

describe('a random walk over zoom and pan', () => {
  // Seeded rather than `Math.random`, so a failure names the seed that
  // reproduces it.
  function lcg(seed: number) {
    let state = seed
    return () => {
      state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296
      return state / 4_294_967_296
    }
  }

  const ZOOMS = [20, 60, 150, 400, 900, 1500, 3000]

  async function quiesce(display: { isLoading: boolean }) {
    for (let i = 0; i < 6; i++) {
      jest.advanceTimersByTime(800)
      await jest.runAllTimersAsync()
      if (!display.isLoading) {
        break
      }
    }
  }

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('holds at seed %i', async seed => {
    const rand = lcg(seed)
    const env = createTestEnvironment()
    const { display, view, mockRpcCall } = env.createDisplay()
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 5_000_000, refName: 'ctgA' },
    ])
    mockRpcCall.mockImplementation(byteGatedRender(BYTES_PER_BP))

    for (let step = 0; step < 12; step++) {
      view.zoomTo(ZOOMS[Math.floor(rand() * ZOOMS.length)]!)
      view.scrollTo(Math.floor(rand() * 4000))
      await quiesce(display)

      const at = `seed ${seed} step ${step} bpPerPx ${view.bpPerPx}`
      const held = heldExtent(display)

      for (const [idx, claim] of display.loadedRegions.entries()) {
        expect({
          at,
          idx,
          claimIsBackedByData:
            !!held && held.start <= claim.start && held.end >= claim.end,
        }).toEqual({ at, idx, claimIsBackedByData: true })
      }

      if (!display.regionTooLarge && !display.isLoading && !display.error) {
        const block = view.visibleRegions[0]!
        expect({
          at,
          heldCoversViewport:
            !!held && held.start <= block.start && held.end >= block.end,
        }).toEqual({ at, heldCoversViewport: true })
      }
    }
  })
})
