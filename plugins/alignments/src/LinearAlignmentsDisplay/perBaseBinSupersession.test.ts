import { createRpcTestEnvironment } from './testUtils.ts'

type Env = ReturnType<
  ReturnType<typeof createRpcTestEnvironment>['createDisplay']
>

// The state after a fetch settled at the current zoom: every buffered region
// stamped with the bin that fetch was issued under, and the canvas painted.
// `setLoadedRegion`'s default key is `regionFetchKey`, which is what a real
// commit stamps, so nothing here invents a key the fetch could not have written.
function simulateLoaded({ view, display }: Pick<Env, 'view' | 'display'>) {
  for (const b of view.bufferedVisibleRegions) {
    display.setLoadedRegion(b.displayedRegionIndex, b.region)
  }
  display.markCanvasDrawn()
  display.stopActiveFetch()
}

// Zoom, then flush the 500ms coarse-block throttle the way a discrete jump
// does, so the fetch's debounced inputs describe the viewport it is issued for.
function settleAt({ view }: Pick<Env, 'view'>, bpPerPx: number) {
  view.zoomTo(bpPerPx)
  view.settleCoarseBlocks()
}

// The per-base wall is sampled at `subPixelBinBp` off the DEBOUNCED zoom, so
// data fetched several octaves out is genuinely too coarse to draw once the
// user zooms in — the samples stripe rather than tile. `dataSuperseded` is what
// keeps that window from reading as fresh, and the window it has to cover is
// the debounce PLUS the RPC: a reader zooms and then reaches for the export
// menu, which lands inside the debounce, not after it.
describe('per-base bin supersession', () => {
  it('reports the held wall superseded the moment a zoom outruns its bin', () => {
    const env = createRpcTestEnvironment().createDisplay()
    const { display, view } = env

    display.setColorScheme({ type: 'perBaseLetter' })
    settleAt(env, 16)
    view.scrollTo(1000)
    simulateLoaded(env)

    expect(display.perBaseBinBp).toBe(8)
    expect(display.loadedRegions.get(0)?.fetchKey).toBe('8')
    expect(display.dataSuperseded).toBe(false)
    expect(display.svgReady).toBe(true)

    // Three octaves in, and NOT settled — this is the debounce window. The
    // viewport stays inside the region it holds, so the spatial check still
    // says covered and only the bin can tell that a wall sampled one base in
    // eight is about to be drawn at one base per pixel.
    view.zoomTo(1)

    expect(view.coarseBpPerPx).toBeGreaterThan(8)
    expect(display.viewportWithinLoadedData).toBe(true)
    expect(display.livePerBaseBinBp).toBe(1)
    expect(display.dataSuperseded).toBe(true)
    expect(display.svgReady).toBe(false)
  })

  it('flips back once the refetch lands at the new bin', () => {
    const env = createRpcTestEnvironment().createDisplay()
    const { display, view } = env

    display.setColorScheme({ type: 'perBaseLetter' })
    settleAt(env, 16)
    view.scrollTo(1000)
    simulateLoaded(env)

    view.zoomTo(1)
    expect(display.dataSuperseded).toBe(true)

    view.settleCoarseBlocks()
    simulateLoaded(env)

    expect(display.loadedRegions.get(0)?.fetchKey).toBe('1')
    expect(display.dataSuperseded).toBe(false)
    expect(display.svgReady).toBe(true)
  })

  it('is unmoved by the same zoom in a scheme that paints no wall', () => {
    const env = createRpcTestEnvironment().createDisplay()
    const { display, view } = env

    settleAt(env, 16)
    view.scrollTo(1000)
    simulateLoaded(env)

    view.zoomTo(1)

    expect(display.perBaseBinBp).toBe(1)
    expect(display.livePerBaseBinBp).toBe(1)
    expect(display.dataSuperseded).toBe(false)
    expect(display.svgReady).toBe(true)
  })
})
