import { getContainingView } from '@jbrowse/core/util'
import { waitFor } from '@testing-library/react'
import { when } from 'mobx'

import { TOP_HIT_FACT } from '../GWASAdapter/topHit.ts'
import { LD_COLOR, LD_MARKS } from './ldPlot.ts'
import { manhattanFixture, topHitFacts } from './manhattan.fixture.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { LdJoin } from '../GWASAdapter/ldJoin.ts'
import type { Region } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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

// As the worker splits LD_MARKS: the hit the join names as the index is drawn
// by the second mark, and every other point by the first. The adapter reports
// the region's top hit whichever mark draws it.
function makeResult({ region, opts }: FetchArgs) {
  const hit = HITS[region.refName]!
  const drawn = manhattanFixture({
    x: [hit.pos],
    y: [hit.score],
    flatbush: false,
  })
  const none = manhattanFixture({ x: [], y: [], flatbush: false })
  return {
    layers: opts?.ld?.start === hit.pos ? [none, drawn] : [drawn, none],
    facts: topHitFacts(hit.pos, hit.score),
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
  // indexSnp is a fetch input picked from fetched data, so the pick waits for
  // a complete load: mid-batch, topSnp is the best of what has arrived.
  it('picks the global top hit once, after the whole load', async () => {
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

    await settle(5)
    expect(mockRpcCall).toHaveBeenCalledTimes(4)
  })

  // The pick is once: moving the view or restoring a session never moves
  // the index, which the user changes by right-click or the track menu.
  describe('once picked', () => {
    function loaded(displaySnapshot?: Record<string, unknown>) {
      const { createDisplay, mockRpcCall } = createTestEnvironment({
        marks: LD_MARKS,
      })
      mockRpcCall.mockImplementation(
        (_sessionId: string, _method: string, args: FetchArgs) =>
          Promise.resolve(makeResult(args)),
      )
      const { display } = createDisplay({ displaySnapshot })
      const view = getContainingView(display) as LinearGenomeViewModel
      return { display, view, mockRpcCall }
    }

    it('stays put when the view moves, with a notice while out of reach', async () => {
      const { display, view } = loaded()
      await settle(8)
      expect(display.indexSnp).toBe(TOP_SNP)
      expect(display.displayNotices).toEqual([])

      view.navTo({ refName: 'ctgA', start: 0, end: 10_000 })
      await settle(8)
      expect(display.indexSnp).toBe(TOP_SNP)
      expect(display.topSnp).toBe('ctgA:101')
      expect(display.displayNotices).toEqual([
        expect.stringContaining(`LD index SNP ${TOP_SNP}`),
      ])
      expect(display.cornerNotices).toEqual(
        expect.arrayContaining(display.displayNotices),
      )

      display.setIndexSnpToTopHit()
      expect(display.indexSnp).toBe('ctgA:101')
      expect(display.displayNotices).toEqual([])
    })

    it('keeps a restored index the top hit would replace', async () => {
      const { display } = loaded({ indexSnp: 'ctgA:101' })
      await settle(8)
      expect(display.topSnp).toBe(TOP_SNP)
      expect(display.indexSnp).toBe('ctgA:101')
    })

    it('picks again when LD coloring is turned back on', async () => {
      const { display, view } = loaded()
      await settle(8)
      view.navTo({ refName: 'ctgA', start: 0, end: 10_000 })
      await settle(8)
      display.setLdColoring(false)
      await settle(8)
      display.setLdColoring(true)
      await settle(8)
      expect(display.indexSnp).toBe('ctgA:101')
    })
  })

  // The other way in, and the one production actually uses: the track menu's
  // "Color by LD" toggle, flipped on a display that has already loaded. Every
  // other test here starts in LD mode because that is what a restored session
  // does, and that shape cannot see a toggle whose write fails to reach the
  // fetch — `setLdColoring` writes the marks, so it invalidates through
  // `settingsFetchInputs` rather than through anything the display holds.
  it('adopts the index when the user turns LD coloring on', async () => {
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
  // the same ~323.3), and regions land in RPC-resolution order, so a tie
  // broken by arrival would pick a different SNP on each load.
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
      facts: topHitFacts(pos, 9),
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

  // A region scrolled off screen stays loaded, and counting it held the index
  // on a contig the view no longer showed, every visible point grey.
  it('counts only the regions on screen', () => {
    const { createDisplay } = createTestEnvironment({ marks: LD_MARKS })
    const { display } = createDisplay()
    const view = getContainingView(display) as LinearGenomeViewModel
    const payload = (pos: number, score: number) => ({
      layers: [manhattanFixture({ x: [pos], y: [score], flatbush: false })],
      facts: topHitFacts(pos, score),
    })
    const region = (refName: string) => ({
      refName,
      start: 0,
      end: 10_000,
      assemblyName: 'volvox',
    })
    display.setRpcData(0, payload(100, 9), region('ctgA'))
    display.setRpcData(1, payload(500, 3), region('ctgB'))
    expect(display.topSnp).toBe('ctgA:101')

    view.navTo({ refName: 'ctgB', start: 0, end: 10_000 })
    expect(display.topSnp).toBe('ctgB:501')
  })

  // A fetch reaches half a screen past each edge, and the region's single top
  // hit sat there: the index landed off screen with every visible point grey.
  it('counts only the hits on screen, not the loaded margin', () => {
    const { createDisplay } = createTestEnvironment({ marks: LD_MARKS })
    const { display } = createDisplay()
    const view = getContainingView(display) as LinearGenomeViewModel
    view.navTo({ refName: 'ctgA', start: 4000, end: 6000 })
    display.setRpcData(
      0,
      {
        layers: [
          manhattanFixture({ x: [3000, 5000], y: [9, 3], flatbush: false }),
        ],
        facts: {
          [TOP_HIT_FACT]: [
            { start: 3000, score: 9 },
            { start: 5000, score: 3 },
          ],
        },
      },
      { refName: 'ctgA', start: 3000, end: 7000, assemblyName: 'volvox' },
    )
    expect(display.topSnp).toBe('ctgA:5001')
  })

  // Manhattan's supersession replaced the mark display's, so an export of a
  // plot with rows passed before the listing that adds and orders them
  // landed. The listing must not reach the pick, which would write the top
  // hit over the user's index.
  it("keeps the mark display's wait on its row listing, apart from the auto-pick", async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment({
      marks: LD_MARKS,
      rows: 'source',
    })
    mockRpcCall.mockImplementation(
      (_sessionId: string, method: string, args: FetchArgs) =>
        method === 'MarkGetRowSources'
          ? new Promise(() => {})
          : Promise.resolve(makeResult(args)),
    )
    const { display } = createDisplay()
    display.colorByLdToHit({ refName: 'ctgA', start: 99 })

    await settle(8)
    expect(display.rowListingSettled).toBe(false)
    expect(display.dataSuperseded).toBe(true)
    expect(display.indexSnp).toBe('ctgA:100')
  })

  // The top hit is read off the file, not the points the LD marks draw, which
  // the join's own `ld_role` filter changes: with the index twin deleted in
  // Edit plot, the picked SNP is filtered out of the drawn points.
  it('settles where the plot draws every SNP but the index', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment({
      marks: [
        {
          mark: 'point',
          transform: [
            { type: 'filter', expr: "jexl:feature.ld_role != 'index'" },
          ],
          encoding: { y: 'score', color: LD_COLOR },
        },
      ],
    })
    const ctgB = [
      { pos: 500, score: 9 },
      { pos: 600, score: 8 },
    ]
    mockRpcCall.mockImplementation(
      (_sessionId: string, _method: string, { region, opts }: FetchArgs) => {
        const drawn =
          region.refName === 'ctgB'
            ? ctgB.filter(h => h.pos !== opts?.ld?.start)
            : [{ pos: 100, score: 3 }]
        return Promise.resolve({
          layers: [
            manhattanFixture({
              x: drawn.map(h => h.pos),
              y: drawn.map(h => h.score),
              flatbush: false,
            }),
          ],
          facts:
            region.refName === 'ctgB'
              ? topHitFacts(500, 9)
              : topHitFacts(100, 3),
        })
      },
    )
    const { display } = createDisplay()

    await settle(8)
    await waitFor(() => {
      expect(display.indexSnp).toBe(TOP_SNP)
    })
    expect(mockRpcCall).toHaveBeenCalledTimes(4)
    await settle(8)
    expect(display.indexSnp).toBe(TOP_SNP)
    expect(mockRpcCall).toHaveBeenCalledTimes(4)
  })

  // A plot whose only LD mark plots `r2` draws nothing until a join writes
  // the field, so an index read off drawn points never arrived to join one.
  it('adopts an index for a plot that draws nothing before the join', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment({
      marks: [{ mark: 'point', encoding: { y: 'r2' } }],
    })
    mockRpcCall.mockImplementation(
      (_sessionId: string, _method: string, { region, opts }: FetchArgs) => {
        const hit = HITS[region.refName]!
        return Promise.resolve({
          layers: [
            manhattanFixture({
              x: opts?.ld ? [hit.pos] : [],
              y: opts?.ld ? [1] : [],
              flatbush: false,
            }),
          ],
          facts: topHitFacts(hit.pos, hit.score),
        })
      },
    )
    const { display } = createDisplay()

    await settle(8)
    await waitFor(() => {
      expect(display.indexSnp).toBe(TOP_SNP)
    })
    expect(mockRpcCall).toHaveBeenCalledTimes(4)
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

  // With no ldAdapter the `r2` field is read off the features like any other
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
