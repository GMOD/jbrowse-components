import { waitFor } from '@testing-library/react'

import { testWireRegionData } from '../LinearMafGetAlignmentDataRpc/testWire.ts'
import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { createMafTestEnvironment } from './testEnv.ts'

// The LinearMafGetAlignmentData result for a region with no alignment blocks on
// a sample-discovery track (no configured `samples`): the worker discovers rows
// from the blocks present, so an empty region yields an empty `samples` list.
function makeEmptyMafResult() {
  return {
    samples: [],
    treeNewick: undefined,
    samplesCanonical: false,
    regionData: testWireRegionData([], { coverage: emptyMafCoverage() }),
  }
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('LinearMafDisplay zero-block loading', () => {
  // Regression: a sample-discovery MAF track (no configured `samples`) over a
  // region with no alignment blocks resolves to zero sources. The render
  // callback's first-paint gate must therefore key off "a region has loaded",
  // not off the row list being non-empty — gating on the rows alone kept the
  // callback returning false after the fetch completed, so canvasDrawn never
  // flipped and the loading overlay spun forever. Once a region has loaded the
  // callback runs and the canvas clears, even with nothing to draw.
  //
  // This is also why `sourcesKnown` exists rather than the gate testing
  // `sources` for truthiness: `sources` is a resolved array now, and an empty
  // one arrives both from "no fetch yet" and from "a fetch that found no rows"
  // — this test's state, and the one where the gate must open.
  it('releases the first-paint gate after a fetch that returns no blocks/samples', async () => {
    const { createDisplay, mockRpcCall } = createMafTestEnvironment({
      assemblyEnd: 50_000,
      viewRegionEnd: 10_000,
    })
    mockRpcCall.mockResolvedValue(makeEmptyMafResult())
    const { display } = createDisplay()

    // the gate, as the render callback spells it
    expect(display.sourcesKnown || display.loadedRegions.size > 0).toBe(false)
    // ...and the state it feeds the backend is resolved throughout, so nothing
    // downstream has to re-encode "not ready" as a missing render state
    expect(display.renderState).toBeDefined()

    jest.advanceTimersByTime(700)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    // resolved, and empty — the row list never went `undefined`, so a consumer
    // cannot mistake "found no rows" for "not loaded"; that is `sourcesKnown`
    expect(display.sources).toEqual([])
    expect(display.sourcesKnown).toBe(false)
    expect(display.sourcesKnown || display.loadedRegions.size > 0).toBe(true)
    expect(display.renderState).toBeDefined()
  })
})
