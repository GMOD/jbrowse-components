import { waitFor } from '@testing-library/react'
import { autorun } from 'mobx'

import { processFeaturesFromArrays } from '../util.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { WiggleDataResult } from '@jbrowse/wiggle-core'

// The RenderMultiWiggleData RPC result for a region the adapter has no features
// in: getFallbackSourceArrays groups zero features into zero source arrays and
// getSources(regions) finds no `source` values, so the executor returns an
// empty sources list. This is exactly what a bedMethyl file returns for a
// chromosome it doesn't cover. The RPC is batched (one call, all regions), so
// the result is an array — one entry per requested region.
function makeEmptyMultiWiggleData(): WiggleDataResult[] {
  return [{ sources: [] }]
}

// A RenderMultiWiggleData RPC result naming the given sources (feature arrays
// are irrelevant to source-list accumulation, so they stay empty).
function makeMultiWiggleData(names: string[]): WiggleDataResult {
  const empty = processFeaturesFromArrays(
    {
      starts: new Int32Array(0),
      ends: new Int32Array(0),
      scores: new Float32Array(0),
      minScores: undefined,
      maxScores: undefined,
      count: 0,
    },
    0,
  )
  return { sources: names.map(name => ({ name, ...empty })) }
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('MultiLinearWiggleDisplay zero-feature loading', () => {
  // Regression: a MultiQuantitativeTrack fed a plain feature adapter (the
  // modkit bedMethyl use-case) over a region the file doesn't cover returns
  // zero sources / zero features. renderState must still resolve (to the
  // EMPTY_PLOT_DOMAIN stub) so renderBlocks runs, clears the canvas, and flips
  // canvasDrawn — otherwise the display spins on the loading overlay forever.
  // "Still loading" is now the render callback's `rpcDataMap.size === 0`
  // first-paint gate, not a nullable renderState: the state is a stub both
  // before and after the fetch; what changes is that a (zero-feature) region
  // entry has loaded, so the size gate passes and the stub paints.
  it('renderState stays a stub through a zero-feature fetch', async () => {
    const { createDisplay, mockRpcCall } = createTestEnvironment()
    mockRpcCall.mockResolvedValue(makeEmptyMultiWiggleData())
    const { display } = createDisplay()

    // before the fetch: nothing loaded (the first-paint gate holds), stub state
    expect(display.rpcDataMap.size).toBe(0)
    expect(display.renderState).toBeDefined()

    jest.advanceTimersByTime(700)
    await waitFor(() => {
      expect(display.loadedRegions.size).toBe(1)
    })

    // after the zero-feature fetch: an (empty) region entry exists, so the size
    // gate passes and the stub paints; the score domain stays undefined.
    expect(display.rpcDataMap.size).toBeGreaterThan(0)
    expect(display.numSources).toBe(0)
    expect(display.domain).toBeUndefined()
    expect(display.renderState).toBeDefined()
  })
})

describe('MultiLinearWiggleDisplay source accumulation across regions', () => {
  // #3 regression: a plain feature adapter (the bedMethyl use-case) discovers
  // sources per region rather than from a static getSources. A source with zero
  // features in the first fetched region must still appear once a later region
  // reveals it — `sourcesWithoutLayout` unions every loaded region rather than
  // reading the first one, otherwise the source stays invisible forever.
  it('merges sources first seen in a later region', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    display.setRpcData(0, makeMultiWiggleData(['a', 'b']))
    expect(display.sourcesWithoutLayout.map(s => s.name)).toEqual(['a', 'b'])

    display.setRpcData(1, makeMultiWiggleData(['a', 'b', 'c']))
    expect(display.sourcesWithoutLayout.map(s => s.name)).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(display.numSources).toBe(3)
  })

  // The list reaches `gpuProps()`, whose identity re-encodes every loaded
  // region — so a refetch that reports the same rows has to hand back the same
  // array. That is the structural comparer on the computed behind this getter,
  // and it only holds while something observes it, which the upload autorun
  // does.
  it('hands back one array while the rows are unchanged', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    const seen: unknown[] = []
    const stop = autorun(() => {
      seen.push(display.sourcesWithoutLayout)
    })
    display.setRpcData(0, makeMultiWiggleData(['a', 'b']))
    display.setRpcData(1, makeMultiWiggleData(['a', 'b']))
    stop()

    expect(new Set(seen).size).toBe(2)
  })

  it('preserves existing order and appends only genuinely-new sources', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    display.setRpcData(0, makeMultiWiggleData(['b', 'a']))
    display.setRpcData(1, makeMultiWiggleData(['a', 'c', 'b']))
    expect(display.sourcesWithoutLayout.map(s => s.name)).toEqual([
      'b',
      'a',
      'c',
    ])
  })
})
