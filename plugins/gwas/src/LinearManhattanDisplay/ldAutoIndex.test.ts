import { waitFor } from '@testing-library/react'
import { when } from 'mobx'

import { LD_MARKS } from './ldPlot.ts'
import { manhattanFixture } from './manhattanFixture.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { LdJoin } from '../GWASAdapter/ldJoin.ts'
import type { Region } from '@jbrowse/core/util'

interface FetchArgs {
  region: Region
  opts?: { ld?: LdJoin }
}

// Two regions, with the top hit deliberately in the SECOND one — the region
// that lands last. That ordering is what the auto-index autorun has to survive:
// mid-batch, ctgA's hit is the best seen so far.
const HITS: Record<string, { pos: number; score: number }> = {
  ctgA: { pos: 100, score: 3 },
  ctgB: { pos: 500, score: 9 },
}
const TOP_SNP = 'ctgB:501'
const HIT_REGION = {
  refName: 'ctgA',
  start: 0,
  end: 1000,
  assemblyName: 'volvox',
}

// As the worker splits LD_MARKS: the hit the join names as the index is drawn
// by the second mark, and every other point by the first.
function makeResult({ region, opts }: FetchArgs) {
  const hit = HITS[region.refName]!
  const index = opts?.ld?.index
  const drawn = manhattanFixture({
    x: [hit.pos],
    y: [hit.score],
    flatbush: false,
  })
  const none = manhattanFixture({ x: [], y: [], flatbush: false })
  return {
    layers:
      index && 'start' in index && index.start === hit.pos
        ? [none, drawn]
        : [drawn, none],
  }
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// Drive the debounced fetch autorun repeatedly, letting each resulting fetch
// resolve, so any refetch the auto-index triggers gets serviced.
async function settle(times: number) {
  for (let i = 0; i < times; i++) {
    jest.advanceTimersByTime(700)
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  }
}

describe('LinearManhattanDisplay LD auto-index', () => {
  // Regression: indexSnp is both a fetch input (adapterOptions -> rpcProps ->
  // SettingsInvalidate) and derived from the fetched data (topSnp). Reading
  // a partial load made the index flip between each partially-loaded winner
  // and the true top hit, each flip superseding the fetch and refetching —
  // forever, with the plot never settling. Gating on a settled load makes
  // topSnp a fixpoint.
  it('settles on the global top hit without refetching forever', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment({
      marks: LD_MARKS,
    })
    mockRpcCall.mockImplementation(
      (_sessionId: string, _method: string, args: FetchArgs) =>
        Promise.resolve(makeResult(args)),
    )
    const { display } = createDisplay()

    await settle(8)
    await waitFor(() => {
      expect(display.indexSnp).toBe(TOP_SNP)
    })
    // 2 regions x 2 rounds: one to load, one to recolor once the index is
    // adopted. Adopting the top hit must cost exactly one recolor round-trip.
    expect(mockRpcCall).toHaveBeenCalledTimes(4)

    // Converged: further ticks must provoke no new work. A livelock keeps
    // issuing a fresh pair of region fetches on every debounce window.
    await settle(5)
    expect(mockRpcCall).toHaveBeenCalledTimes(4)
  })

  // The other way in, and the one production actually uses: the track menu's
  // "Color by LD" toggle, flipped on a display that has already loaded. Every
  // other test here starts in LD mode because that is what a restored session
  // does, and that shape cannot see a toggle whose write fails to reach the
  // fetch — `setLdColoring` writes the marks, so it invalidates through
  // `settingsFetchInputs` rather than through anything the display holds.
  it('adopts the index when the user turns LD colouring on', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockImplementation(
      (_sessionId: string, _method: string, args: FetchArgs) =>
        Promise.resolve(makeResult(args)),
    )
    const { display } = createDisplay()

    await settle(8)
    // loaded, and with no index: nothing asked for one
    expect(display.indexSnp).toBeUndefined()
    const beforeToggle = mockRpcCall.mock.calls.length

    display.setLdColoring(true)
    await settle(8)

    await waitFor(() => {
      expect(display.indexSnp).toBe(TOP_SNP)
    })
    expect(mockRpcCall.mock.calls.length).toBeGreaterThan(beforeToggle)
  })

  // Exact ties at the top are routine (negLog10 clamps every underflowed p=0 to
  // the same ~323.3), and adopting the index refetches, which clears rpcDataMap
  // and refills it in RPC-resolution order. If topSnp broke ties by arrival
  // order it would flip between the tied SNPs and never converge — the same
  // livelock as above, reached a different way.
  it('breaks a score tie by region index, not by which region landed first', () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment({
      marks: LD_MARKS,
    })
    mockRpcCall.mockImplementation(
      (_sessionId: string, _method: string, args: FetchArgs) =>
        Promise.resolve(makeResult(args)),
    )
    const tiedRegion = {
      refName: 'ctgA',
      start: 0,
      end: 1000,
      assemblyName: 'volvox',
    }
    const tied = (pos: number) => ({
      layers: [manhattanFixture({ x: [pos], y: [9], flatbush: false })],
    })

    const first = createDisplay().display
    first.setRpcData(0, tied(100), tiedRegion)
    first.setRpcData(1, tied(500), tiedRegion)
    expect(first.topSnp).toBe('ctgA:101')

    const second = createDisplay().display
    second.setRpcData(1, tied(500), tiedRegion)
    second.setRpcData(0, tied(100), tiedRegion)
    expect(second.topSnp).toBe('ctgA:101')
  })

  // Adopting either of two tied SNPs moves it into the index mark, so a tie
  // broken by mark order would hand the index back and forth.
  it('breaks a score tie in one region by position, not by the mark drawing it', () => {
    const { display } = createTestEnvironment({
      marks: LD_MARKS,
    }).createDisplay()
    const at = (pos: number) =>
      manhattanFixture({ x: [pos], y: [9], flatbush: false })
    display.setRpcData(0, { layers: [at(500), at(100)] }, HIT_REGION)
    expect(display.topSnp).toBe('ctgA:101')
    display.setRpcData(0, { layers: [at(100), at(500)] }, HIT_REGION)
    expect(display.topSnp).toBe('ctgA:101')
  })

  it('reads no top hit off an LD mark that plots no y', () => {
    const { display } = createTestEnvironment({
      marks: [
        { mark: 'span', encoding: { color: { field: 'ld' } } },
        ...LD_MARKS,
      ],
    }).createDisplay()
    const at = (pos: number, score: number) =>
      manhattanFixture({ x: [pos], y: [score], flatbush: false })
    display.setRpcData(
      0,
      { layers: [at(100, 50), at(500, 9), at(700, 3)] },
      HIT_REGION,
    )
    expect(display.ldMarkIndexes).toEqual([1, 2])
    expect(display.topSnp).toBe('ctgA:501')
  })

  // Regression (empty SVG/PNG export): `awaitSvgReady` samples `svgReady` once
  // and then renders. The first load lands with no index SNP, so the export
  // gate opened over data the auto-pick was about to invalidate — by paint time
  // the map was cleared and the debounced refetch had not landed, so the lane
  // exported with the LD legend and not a single point. The gate has to stay
  // shut until the index the data was colored under is the one being kept.
  it('opens the export gate only on data colored under the adopted index', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment({
      marks: LD_MARKS,
    })
    mockRpcCall.mockImplementation(
      (_sessionId: string, _method: string, args: FetchArgs) =>
        Promise.resolve(makeResult(args)),
    )
    const { display } = createDisplay()

    let atGate: { indexSnp: string | undefined; regions: number } | undefined
    const disposer = when(
      () => display.svgReady,
      () => {
        atGate = {
          indexSnp: display.indexSnp,
          regions: display.rpcDataMap.size,
        }
      },
    )
    await settle(8)
    disposer()

    expect(atGate).toEqual({ indexSnp: TOP_SNP, regions: 2 })
  })

  // With no ldAdapter the `ld` field is read off the features like any other
  // field, and no join reads an index, so none is adopted.
  it('adopts no index and fetches once with no ldAdapter configured', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment({
      marks: LD_MARKS,
      ldAdapter: false,
    })
    mockRpcCall.mockImplementation(
      (_sessionId: string, _method: string, args: FetchArgs) =>
        Promise.resolve(makeResult(args)),
    )
    const { display } = createDisplay()

    let atGate: { indexSnp: string | undefined; regions: number } | undefined
    const disposer = when(
      () => display.svgReady,
      () => {
        atGate = {
          indexSnp: display.indexSnp,
          regions: display.rpcDataMap.size,
        }
      },
    )
    await settle(8)
    disposer()

    expect(display.joinsLd).toBe(false)
    expect(atGate).toEqual({ indexSnp: undefined, regions: 2 })
    expect(mockRpcCall).toHaveBeenCalledTimes(2)
  })
})
