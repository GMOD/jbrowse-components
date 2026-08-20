import { waitFor } from '@testing-library/react'

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
})
