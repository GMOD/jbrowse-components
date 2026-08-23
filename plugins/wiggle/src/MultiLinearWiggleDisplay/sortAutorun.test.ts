import { waitFor } from '@testing-library/react'

import { createTestEnvironment, makeSource } from './testEnv.ts'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

// One source covering the whole test region at a flat score, so the ranking at
// any base in it is unambiguous.
function scored(name: string, score: number) {
  return {
    ...makeSource(name),
    featurePositions: new Uint32Array([0, 10_000]),
    featureScores: new Float32Array([score]),
    numFeatures: 1,
  }
}

function environmentWith(scores: Record<string, number>) {
  const env = createTestEnvironment()
  env.mockRpcCall.mockImplementation(() =>
    Promise.resolve([
      { sources: Object.entries(scores).map(([name, s]) => scored(name, s)) },
    ]),
  )
  return env
}

describe('MultiLinearWiggleDisplay declarative sortRowsBy', () => {
  it('ranks the rows at the named position once its region loads, then clears the flag', async () => {
    const { createDisplay } = environmentWith({ a: 1, b: 5, c: 3 })
    const { display } = createDisplay({
      // inside the first loaded window — the test view is 800px wide, so the
      // fetch covers roughly ctgA:0-1200 rather than the whole contig
      sortRowsBy: { refName: 'ctgA', pos: 600 },
    })

    jest.advanceTimersByTime(700)
    await waitFor(() => {
      expect(display.sources.map(s => s.name)).toEqual(['b', 'c', 'a'])
    })

    // one-shot: the trigger clears itself, so a saved session keeps the row
    // order it produced without re-sorting on every load
    expect(display.sortRowsBy).toBeUndefined()
    expect(display.layout.map(s => s.name)).toEqual(['b', 'c', 'a'])
  })

  // The provenance this prop exists for is a session or figure spec, where the
  // refName is typed by hand — so it is an alias as often as the assembly's own
  // name, while `loadedRegions` is canonical. Unnormalized the gate never
  // passes, which is indistinguishable from the region simply not being loaded:
  // no sort, no clear, no error.
  it('ranks the rows when the spec names the region by an alias', async () => {
    const { createDisplay } = environmentWith({ a: 1, b: 5, c: 3 })
    // 'chrA' is the test assembly's alias for the canonical 'ctgA'
    const { display } = createDisplay({
      sortRowsBy: { refName: 'chrA', pos: 600 },
    })

    jest.advanceTimersByTime(700)
    await waitFor(() => {
      expect(display.sources.map(s => s.name)).toEqual(['b', 'c', 'a'])
    })

    expect(display.sortRowsBy).toBeUndefined()
  })

  // The slot is `frozen`, so the typed shape describes what a session author is
  // meant to write rather than checking what they did. A spec naming a position
  // and no refName names no column, and the normalization it reaches
  // lower-cases what it is handed — so the missing half threw out of the
  // autorun instead of declining to sort.
  //
  // Asserted on `console.error`, because that is the only place the difference
  // shows: mobx catches what a reaction throws and reports it there, so the
  // rows come out unsorted either way and every assertion about the display
  // passes over the throw. Which is how it would have shipped.
  it('declines a spec that names no refName, rather than throwing', async () => {
    const reported = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { createDisplay } = environmentWith({ a: 1, b: 5 })
      const { display } = createDisplay({
        sortRowsBy: { pos: 600 } as unknown as { refName: string; pos: number },
      })

      jest.advanceTimersByTime(700)
      await waitFor(() => {
        expect(display.sourcesWithoutLayout.length).toBe(2)
      })

      expect(display.layout).toEqual([])
      expect(reported).not.toHaveBeenCalled()
    } finally {
      reported.mockRestore()
    }
  })

  it('holds the trigger rather than spending it on a region that never loads', async () => {
    // sorting against no data ranks every row equally — it would clear the flag
    // and leave a figure showing unsorted rows with nothing to say why
    const { createDisplay } = environmentWith({ a: 1, b: 5 })
    const { display } = createDisplay({
      sortRowsBy: { refName: 'ctgB', pos: 600 },
    })

    jest.advanceTimersByTime(700)
    await waitFor(() => {
      expect(display.sourcesWithoutLayout.length).toBe(2)
    })

    expect(display.layout).toEqual([])
    expect(display.sortRowsBy).toEqual({ refName: 'ctgB', pos: 600 })
  })
})
