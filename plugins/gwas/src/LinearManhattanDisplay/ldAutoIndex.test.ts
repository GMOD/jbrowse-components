import { waitFor } from '@testing-library/react'
import { when } from 'mobx'

import { createTestEnvironment } from './testEnv.ts'

import type { ManhattanRpcResult } from '../ManhattanRPC/rpcTypes.ts'
import type { Region } from '@jbrowse/core/util'

// Two regions, with the top hit deliberately in the SECOND one — the region
// that lands last. That ordering is what the auto-index autorun has to survive:
// mid-batch, ctgA's hit is the best seen so far.
const HITS: Record<string, { pos: number; score: number }> = {
  ctgA: { pos: 100, score: 3 },
  ctgB: { pos: 500, score: 9 },
}
const TOP_SNP = 'ctgB:501'

function makeResult(region: Region): ManhattanRpcResult {
  const hit = HITS[region.refName]!
  return {
    positions: new Uint32Array([hit.pos]),
    ends: new Uint32Array([hit.pos + 1]),
    glyphs: new Uint8Array([0]),
    scores: new Float32Array([hit.score]),
    colors: new Uint32Array([0xff_00_00_ff]),
    numFeatures: 1,
    scoreMin: hit.score,
    scoreMax: hit.score,
    flatbushData: undefined,
    indexFound: true,
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
  // Regression: indexSnp is both a fetch input (rpcProps -> SettingsInvalidate
  // -> clearAllRpcData) and derived from the fetched data (topSnp). Reading a
  // partial load made the index flip between each partially-loaded winner and
  // the true top hit, each flip wiping the data and refetching — forever, with
  // the plot never painting. Gating on a settled load makes topSnp a fixpoint.
  it('settles on the global top hit without refetching forever', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment({
      colorBy: 'ld',
    })
    mockRpcCall.mockImplementation(
      (_sessionId: string, _method: string, args: { region: Region }) =>
        Promise.resolve(makeResult(args.region)),
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
  // fetch — `setColorBy` writes a config slot, so it invalidates through
  // `rpcPropsCacheKey` rather than through anything the display holds.
  it('adopts the index when the user turns LD colouring on', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockImplementation(
      (_sessionId: string, _method: string, args: { region: Region }) =>
        Promise.resolve(makeResult(args.region)),
    )
    const { display } = createDisplay()

    await settle(8)
    // loaded, and with no index: nothing asked for one
    expect(display.indexSnp).toBeUndefined()
    const beforeToggle = mockRpcCall.mock.calls.length

    display.setColorBy('ld')
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
      colorBy: 'ld',
    })
    mockRpcCall.mockImplementation(
      (_sessionId: string, _method: string, args: { region: Region }) =>
        Promise.resolve(makeResult(args.region)),
    )
    const tied = (pos: number): ManhattanRpcResult => ({
      ...makeResult({ refName: 'ctgA', start: 0, end: 1, assemblyName: 'v' }),
      positions: new Uint32Array([pos]),
      ends: new Uint32Array([pos + 1]),
      scores: new Float32Array([9]),
    })

    const first = createDisplay().display
    first.setRpcData(0, tied(100))
    first.setRpcData(1, tied(500))
    expect(first.topSnp).toBe('ctgA:101')

    const second = createDisplay().display
    second.setRpcData(1, tied(500))
    second.setRpcData(0, tied(100))
    expect(second.topSnp).toBe('ctgA:101')
  })

  // Regression (empty SVG/PNG export): `awaitSvgReady` samples `svgReady` once
  // and then renders. The first load lands with no index SNP, so the export
  // gate opened over data the auto-pick was about to invalidate — by paint time
  // the map was cleared and the debounced refetch had not landed, so the lane
  // exported with the LD legend and not a single point. The gate has to stay
  // shut until the index the data was colored under is the one being kept.
  it('opens the export gate only on data colored under the adopted index', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment({
      colorBy: 'ld',
    })
    mockRpcCall.mockImplementation(
      (_sessionId: string, _method: string, args: { region: Region }) =>
        Promise.resolve(makeResult(args.region)),
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

  // The same gate, for `colorBy: 'ld'` with no ldAdapter configured. LD coloring
  // is inert there, but the auto-pick still writes indexSnp and the write is
  // what clears the load, so gating supersession on the adapter exported the
  // empty lane anyway.
  it('opens the gate on adopted-index data with no ldAdapter configured', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment({
      colorBy: 'ld',
      ldAdapter: false,
    })
    mockRpcCall.mockImplementation(
      (_sessionId: string, _method: string, args: { region: Region }) =>
        Promise.resolve(makeResult(args.region)),
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

    expect(display.ldColoringActive).toBe(false)
    expect(atGate).toEqual({ indexSnp: TOP_SNP, regions: 2 })
  })
})
