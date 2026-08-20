import { waitFor } from '@testing-library/react'

import {
  makeFeatureData,
  makeFlatbushItem,
  packFixtureRects,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

// A region the worker refuses for size, over a region that already holds data —
// i.e. every region the reader zoomed OUT from, which is the common case and was
// the broken one.
//
// `fetchRegions` used to mark every region it ASKED for loaded, from the request,
// while the display stored from the response; canvas keeps `rpcDataMap` across
// every clear (deliberately — the track stays painted through a refetch), so a
// refused region was left claiming a span ten times what its features covered.
// Both halves of the per-region cache rule then answered "current":
// `regionHasData` saw the older payload and the fetch key was the one that very
// fetch was issued under. REGION_TOO_LARGE.md stated the opposite twice, and it
// held only for a region that had never been fetched.
//
// The two axes failed differently, which is why both are here: bytes left a
// banner nothing could release, density released the banner and left the stale
// features painted with nothing on screen to say so.
//
// Two rules close it, and each test names the one it covers:
//  - `loadedRegions` is written where the payload is stored (RegionFetchContext)
//  - `covered` cannot outrank a re-measure the banner is waiting on (gateBlocked)

// Both mocks stamp the payload with the region it was fetched for, as one
// feature spanning it, so a test can ask which region the features the display
// is HOLDING describe. Nothing on the model records that — `loadedBpPerPx` was
// the last partial witness and it is gone.
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

// The byte axis: an index estimate proportional to span, refused over the limit.
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

// The density axis: a uniform features-per-bp track, refused when it lands above
// `maxFeatureScreenDensity` (1/px) at the zoom the fetch was issued at. Density
// per pixel is then `featuresPerBp * bpPerPx` — a function of zoom alone, which
// is what makes the axis release on a zoom back in. `bytes` stays well under the
// limit so only this axis can gate.
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

// The bp span of the payload the display is holding for region 0.
function heldExtent(display: { rpcDataMap: Map<number, unknown> }) {
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

// 20 bytes/bp against the 5MB default limit: the gate admits a fetch below
// ~250,000 bp of buffered span and refuses one above it.
const BYTES_PER_BP = 20

// Every zoom the scenarios below use sits above 100 bp/px, on one side of the
// gene-glyph `auto` threshold. Crossing it moves `effectiveGeneGlyphMode`, which
// is an RPC cache key, so `SettingsInvalidate` clears everything and the refetch
// that follows hides the freeze — a zoom pair straddling 100 passes for the
// wrong reason. (The random walk at the bottom deliberately does cross it: an
// extra refetch must not be a way to end up wrong either.)
const WARM_BP_PER_PX = 150
const WIDE_BP_PER_PX = 1500
// where the density verdict has fallen back under budget while the viewport is
// still wider than what the warm fetch covered
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

  // The refused fetch stored nothing, so the features on screen are still the
  // ones fetched at the warm zoom — a tenth of what is now in view.
  expect(heldExtent(display)).toEqual(warm)

  return { display, view, mockRpcCall, warm }
}

describe('a region refused for size over data already held', () => {
  // Rule 1: the commit lives with the store, so a refused region claims nothing.
  it('does not widen the loaded span for a region it never stored', async () => {
    const { display, warm } = await warmedThenRefused(
      byteGatedRender(BYTES_PER_BP),
    )

    expect(display.loadedRegions.get(0)).toMatchObject(warm)
    expect(display.viewportWithinLoadedData).toBe(false)
  })

  // Rule 2: the byte axis is not rescaled by span, so only a re-measure releases
  // it — and the ordinary fetch IS the re-measure. Zooming back to a span the
  // display already holds data for used to answer `covered`, so that fetch never
  // ran and the banner outlived every zoom.
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

  // ...and exactly one, per settled viewport: a region the gate refuses stores
  // nothing, so nothing must turn that into a refetch loop off its own
  // `fetchGeneration` bump.
  it('re-measures once per settled viewport, not in a loop', async () => {
    const { mockRpcCall } = await warmedThenRefused(
      byteGatedRender(BYTES_PER_BP),
    )
    const callsWhileBlocked = mockRpcCall.mock.calls.length

    jest.advanceTimersByTime(5000)
    await jest.runAllTimersAsync()

    expect(mockRpcCall.mock.calls.length).toBe(callsWhileBlocked)
  })

  // The density axis IS live in bpPerPx — features ÷ pixels falls as you zoom in
  // — so the banner comes down on its own, with no fetch behind it. That used to
  // leave the display in `ready`, painting the narrow payload across the whole
  // viewport. This is the reported symptom.
  it('covers the viewport once density stops gating', async () => {
    const { display, view } = await warmedThenRefused(densityGatedRender(0.002))

    // Part of the way back: 0.8 features/px, under the 1/px budget, so the
    // density verdict goes false — while the viewport is still wider than the
    // span the held features cover. (The fetch buffers half a screen each side,
    // so exactly 2x the warm zoom would land on the held span and prove
    // nothing.)
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

// `regionHasData` is the reader-side check of the write-side rule, and a check
// nothing can trip is worth as much as no check. This is the state the rule
// forbids — a region marked loaded with nothing behind it — reached the only way
// left to reach it, by writing it directly. The display has to notice and
// refetch rather than read the viewport as covered, which is the whole
// difference between a redundant fetch and a track frozen until reload.
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

    // the forbidden state: the claim stays, the payload goes
    display.pruneRpcDataMapToVisible(new Set())
    display.setLoadedRegion(0, view.displayedRegions[0])
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

// The same invariant as a property over a random walk, because the two scenarios
// above are the two that were reported rather than the two that exist. What a
// pure function cannot state is here and nowhere else: which reads MobX tracks,
// the real gate's verdict, and the two debounces between a zoom and a fetch.
//
// Every settled step asserts both halves:
//
//  - **structural** — `loadedRegions` never claims a span the display holds no
//    features for. That one fails the instant the commit drifts back to the
//    request, whatever the gate happens to be doing.
//  - **liveness** — with no banner, no error and nothing in flight, the features
//    the display holds cover the viewport. That is the reported symptom stated
//    as a rule, and the one `covered`-outranking-a-re-measure broke.
describe('a random walk over zoom and pan', () => {
  // Seeded rather than `Math.random`, so a failure names the seed that produced
  // it and re-running is the whole reproduction.
  function lcg(seed: number) {
    let state = seed
    return () => {
      state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296
      return state / 4_294_967_296
    }
  }

  // Wide enough that the gate refuses at the top of the range and admits at the
  // bottom, and it straddles the 100 bp/px gene-glyph threshold on purpose: an
  // RPC-cache-key flip mid-walk is another way the display can end up refetching
  // and must not be a way it ends up wrong.
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

      // structural: a claim is only ever made over data that exists
      for (const [idx, claim] of display.loadedRegions.entries()) {
        expect({
          at,
          idx,
          claimIsBackedByData:
            !!held && held.start <= claim.start && held.end >= claim.end,
        }).toEqual({ at, idx, claimIsBackedByData: true })
      }

      // liveness: nothing is owed while nothing on screen says so
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
