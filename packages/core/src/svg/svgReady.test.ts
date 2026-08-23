import { autorun, observable, runInAction } from 'mobx'

import {
  awaitSvgReady,
  awaitSvgRenders,
  awaitViewInitialized,
  computeSvgReady,
  throwOnExportErrors,
} from './svgReady.ts'

const noTerminals = {
  error: undefined,
  regionTooLarge: false,
  extraTerminal: false,
  fetchCanceled: false,
}

describe('computeSvgReady', () => {
  it('is ready on current data with no terminal', () => {
    expect(computeSvgReady(noTerminals, () => true)).toBe(true)
    expect(computeSvgReady(noTerminals, () => false)).toBe(false)
  })

  it('each terminal resolves the gate on its own, with no data', () => {
    const stale = () => false
    expect(
      computeSvgReady({ ...noTerminals, error: new Error('x') }, stale),
    ).toBe(true)
    expect(
      computeSvgReady({ ...noTerminals, regionTooLarge: true }, stale),
    ).toBe(true)
    expect(
      computeSvgReady({ ...noTerminals, extraTerminal: true }, stale),
    ).toBe(true)
    expect(
      computeSvgReady({ ...noTerminals, fetchCanceled: true }, stale),
    ).toBe(true)
  })

  // The thunk is why a display sitting under a banner doesn't subscribe to the
  // view's visibleRegions/loadedRegions churn — awaitSvgReady's `when` would
  // otherwise re-evaluate on every pan behind the banner.
  it('does not evaluate dataCurrent once a terminal is set', () => {
    const dataCurrent = jest.fn(() => true)
    computeSvgReady({ ...noTerminals, regionTooLarge: true }, dataCurrent)
    expect(dataCurrent).not.toHaveBeenCalled()

    computeSvgReady(noTerminals, dataCurrent)
    expect(dataCurrent).toHaveBeenCalledTimes(1)
  })

  it('tracks only the terminal flags while a terminal is set', () => {
    const m = observable({ regionTooLarge: true, loaded: false })
    const reads: boolean[] = []
    const dispose = autorun(() => {
      reads.push(
        computeSvgReady(
          {
            error: undefined,
            regionTooLarge: m.regionTooLarge,
            extraTerminal: false,
            fetchCanceled: false,
          },
          () => m.loaded,
        ),
      )
    })
    // `loaded` was never read, so touching it must not re-run the autorun
    runInAction(() => {
      m.loaded = true
    })
    expect(reads).toEqual([true])

    // clearing the banner re-runs it, and now `loaded` is in the dep set
    runInAction(() => {
      m.regionTooLarge = false
    })
    expect(reads).toEqual([true, true])
    dispose()
  })
})

describe('awaitSvgReady', () => {
  it('resolves once svgReady flips true', async () => {
    const model = observable({ svgReady: false, error: undefined })
    const p = awaitSvgReady(model)
    runInAction(() => {
      model.svgReady = true
    })
    await expect(p).resolves.toBeUndefined()
  })

  // The wait ends on data, an error or a cancel, so a gate that never opens is
  // none of the three and no further event is coming. Unbounded, that is an
  // export with no output, no error and no end; bounded, it says so. The GWAS
  // LD auto-index could reach it: a fetch input derived from the fetched data
  // that never reaches a fixpoint leaves `svgReady` false forever.
  it('fails with a diagnostic rather than waiting forever', async () => {
    const model = observable({ svgReady: false, error: undefined })
    await expect(awaitSvgReady(model, 20)).rejects.toThrow(
      /never became ready to export, after 0s/,
    )
  })

  // `svgReady` is *true* on error — it is a terminal like any other — so a wait
  // that stopped there handed the export a display with no data and let it
  // export the failure. The postcondition is "there is something to draw",
  // which is what makes this the twin of awaitViewInitialized.
  it('fails on the error terminal rather than resolving into it', async () => {
    const model = observable<{ svgReady: boolean; error: unknown }>({
      svgReady: false,
      error: undefined,
    })
    const p = awaitSvgReady(model)
    runInAction(() => {
      model.error = new Error('HTTP 404 fetching volvox.bam')
      model.svgReady = true
    })
    await expect(p).rejects.toThrow(
      'Cannot export: Error: HTTP 404 fetching volvox.bam',
    )
  })

  // a display that owns its band still draws the soft terminal: over-budget is
  // a state the user navigated to, not a failure to report
  it('resolves on a region-too-large terminal', async () => {
    await expect(
      awaitSvgReady({ svgReady: true, error: undefined }),
    ).resolves.toBeUndefined()
  })

  // a standing cancel is durable until Retry, which an export cannot press —
  // the terminal keeps the wait bounded, and the throw keeps the export from
  // writing that track blank in silence over an on-screen "Loading canceled"
  it('fails on a standing user cancel rather than exporting a blank', async () => {
    const model = observable({
      svgReady: false,
      error: undefined,
      fetchCanceled: false,
    })
    const p = awaitSvgReady(model)
    runInAction(() => {
      model.fetchCanceled = true
      model.svgReady = true
    })
    await expect(p).rejects.toThrow(
      'Cannot export: Error: data loading was canceled',
    )
  })

  // both standing at once (not producible through the action surface, but the
  // policy should still name the more informative one)
  it('prefers the error over the cancel when both stand', async () => {
    await expect(
      awaitSvgReady({
        svgReady: true,
        error: new Error('HTTP 404'),
        fetchCanceled: true,
      }),
    ).rejects.toThrow('Cannot export: Error: HTTP 404')
  })
})

describe('awaitSvgRenders', () => {
  it('returns the values in order when everything renders', async () => {
    await expect(
      awaitSvgRenders([Promise.resolve('a'), Promise.resolve('b')]),
    ).resolves.toEqual(['a', 'b'])
  })

  // the whole point over `Promise.all`: an export of a session with three broken
  // tracks must not send the user back to find the second by fixing the first
  it('reports every failed render, not whichever rejected first', async () => {
    await expect(
      awaitSvgRenders([
        Promise.reject(new Error('paf 404')),
        Promise.resolve('ok'),
        Promise.reject(new Error('bam 404')),
      ]),
    ).rejects.toThrow('Cannot export: Error: paf 404\nError: bam 404')
  })

  // synteny nests one fan-out (a level's ribbon tracks) inside another (the
  // levels), so an outer report that named the inner aggregate as one failure
  // would collapse a level's tracks into a line of its own error text
  it('flattens a nested fan-out into the same flat report', async () => {
    await expect(
      awaitSvgRenders([
        awaitSvgRenders([
          Promise.reject(new Error('level 0 track a')),
          Promise.reject(new Error('level 0 track b')),
        ]),
        Promise.reject(new Error('row track')),
      ]),
    ).rejects.toThrow(
      'Cannot export: Error: level 0 track a\nError: level 0 track b\nError: row track',
    )
  })

  // a display body that throws is a failed export the same way a 404 is, and it
  // has no `exportFailures` list to flatten
  it('reports a render that threw for a reason of its own', async () => {
    await expect(
      awaitSvgRenders([Promise.reject(new TypeError('x is undefined'))]),
    ).rejects.toThrow('Cannot export: TypeError: x is undefined')
  })

  // heterogeneous branches (synteny awaits its rows and its ribbon levels in one
  // fan-out) keep their own types rather than collapsing to a union
  it('keeps a tuple a tuple', async () => {
    const [rows, levels] = await awaitSvgRenders([
      Promise.resolve([{ height: 1 }]),
      Promise.resolve(['ribbons']),
    ])
    expect(rows[0]?.height).toBe(1)
    expect(levels[0]).toBe('ribbons')
  })
})

function uninitializedView(): { initialized: boolean; error: unknown } {
  return observable({ initialized: false, error: undefined })
}

describe('awaitViewInitialized', () => {
  it('resolves once the view initializes', async () => {
    const view = uninitializedView()
    const p = awaitViewInitialized(view)
    runInAction(() => {
      view.initialized = true
    })
    await expect(p).resolves.toBeUndefined()
  })

  // the hang this exists to prevent: an assembly that fails to load leaves
  // `initialized` false forever, so the export has to fail on the error instead
  it('fails on an error the view can never initialize past', async () => {
    const view = uninitializedView()
    const p = awaitViewInitialized(view)
    runInAction(() => {
      view.error = new Error('assembly volvox failed to load')
    })
    await expect(p).rejects.toThrow(
      'Cannot export: Error: assembly volvox failed to load',
    )
  })

  it('exports an initialized view that carries an error', async () => {
    await expect(
      awaitViewInitialized({ initialized: true, error: new Error('a track') }),
    ).resolves.toBeUndefined()
  })
})

describe('throwOnExportErrors', () => {
  it('passes when nothing failed', () => {
    expect(() => {
      throwOnExportErrors([undefined, null])
    }).not.toThrow()
  })

  it('reports every failed track, not just the first', () => {
    expect(() => {
      throwOnExportErrors([new Error('paf 404'), undefined, 'chain parse'])
    }).toThrow('Cannot export: Error: paf 404\nchain parse')
  })

  // the dialog's ErrorBanner shows the message; a caller unwrapping the cause
  // (jbrowse-img's toError) should still reach the original
  it('carries the first failure as the cause', () => {
    const cause = new Error('paf 404')
    expect(() => {
      throwOnExportErrors([cause])
    }).toThrow(expect.objectContaining({ cause }))
  })
})

test('a throwing svgReady getter rejects faithfully, not masked', async () => {
  const model = {
    error: undefined,
    get svgReady(): boolean {
      throw new Error('view.width read before init')
    },
  }
  await expect(awaitSvgReady(model)).rejects.toThrow(
    'view.width read before init',
  )
})
