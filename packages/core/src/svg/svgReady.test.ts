import { autorun, observable, runInAction } from 'mobx'

import { awaitSvgReady, computeSvgReady } from './svgReady.ts'

const noTerminals = { error: undefined, regionTooLarge: false, extraTerminal: false }

describe('computeSvgReady', () => {
  it('is ready on current data with no terminal', () => {
    expect(computeSvgReady(noTerminals, () => true)).toBe(true)
    expect(computeSvgReady(noTerminals, () => false)).toBe(false)
  })

  it('each terminal resolves the gate on its own, with no data', () => {
    const stale = () => false
    expect(computeSvgReady({ ...noTerminals, error: new Error('x') }, stale)).toBe(true)
    expect(computeSvgReady({ ...noTerminals, regionTooLarge: true }, stale)).toBe(true)
    expect(computeSvgReady({ ...noTerminals, extraTerminal: true }, stale)).toBe(true)
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
          { error: undefined, regionTooLarge: m.regionTooLarge, extraTerminal: false },
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

test('resolves once svgReady flips true', async () => {
  const model = observable({ svgReady: false })
  const p = awaitSvgReady(model)
  runInAction(() => {
    model.svgReady = true
  })
  await expect(p).resolves.toBeUndefined()
})

test('a throwing svgReady getter rejects faithfully, not masked', async () => {
  const model = {
    get svgReady(): boolean {
      throw new Error('view.width read before init')
    },
  }
  await expect(awaitSvgReady(model)).rejects.toThrow(
    'view.width read before init',
  )
})
