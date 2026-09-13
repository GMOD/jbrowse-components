import { computeActivityPhase, computeDisplayPhase } from './displayPhase.ts'

const NONE = { renderError: undefined, regionTooLarge: false, error: undefined }
const never = () => {
  throw new Error('loading thunk should not be evaluated')
}

describe('computeDisplayPhase precedence', () => {
  test('renderError wins over everything', () => {
    expect(
      computeDisplayPhase(
        { renderError: new Error('x'), regionTooLarge: true, error: 'y' },
        never,
      ),
    ).toBe('renderError')
  })

  test('tooLarge wins over error and loading', () => {
    expect(
      computeDisplayPhase(
        { renderError: undefined, regionTooLarge: true, error: 'y' },
        never,
      ),
    ).toBe('tooLarge')
  })

  test('error wins over loading', () => {
    expect(
      computeDisplayPhase(
        { renderError: undefined, regionTooLarge: false, error: 'y' },
        never,
      ),
    ).toBe('error')
  })

  test.each(['canceled', 'loading', 'ready'] as const)(
    'the activity phase %s when nothing terminal holds',
    activity => {
      expect(computeDisplayPhase(NONE, () => activity)).toBe(activity)
    },
  )
})

describe('computeDisplayPhase lazy loading evaluation', () => {
  // Load-bearing: the loading condition reads the containing view's reactive
  // state, so it must NOT be evaluated while a terminal flag is set — otherwise
  // a MobX observer reading displayPhase over-subscribes during a terminal
  // state and the banner subtree fails to commit (see DisplayChrome.tsx).
  test.each([
    ['renderError', { ...NONE, renderError: new Error('x') }],
    ['tooLarge', { ...NONE, regionTooLarge: true }],
    ['error', { ...NONE, error: 'boom' }],
  ])('does not call loading thunk when %s is set', (_label, inputs) => {
    const loading = jest.fn(() => 'canceled' as const)
    computeDisplayPhase(inputs, loading)
    expect(loading).not.toHaveBeenCalled()
  })

  test('calls loading thunk only once when no terminal flag is set', () => {
    const loading = jest.fn(() => 'ready' as const)
    computeDisplayPhase(NONE, loading)
    expect(loading).toHaveBeenCalledTimes(1)
  })
})

// A drawn, idle, viewport-current display: `computeActivityPhase` answers
// `ready` here, so each test below flips exactly one input and asserts it alone raises
// the scrim.
const DRAWN = {
  isMinimized: false,
  fetchInert: false,
  viewportEmpty: false,
  isLoading: false,
  fetchCanceled: false,
  awaitingDependentData: false,
  rendersCanvas: true,
  canvasDrawn: true,
}
const current = () => true

describe('computeActivityPhase', () => {
  test('a dependent load that has not first landed is loading', () => {
    expect(
      computeActivityPhase({ ...DRAWN, awaitingDependentData: true }, current),
    ).toBe('loading')
  })

  test('not loading once drawn, idle and viewport-current', () => {
    expect(computeActivityPhase(DRAWN, current)).toBe('ready')
  })

  test('loading while a fetch is in flight', () => {
    expect(computeActivityPhase({ ...DRAWN, isLoading: true }, current)).toBe(
      'loading',
    )
  })

  test('loading before the first paint', () => {
    expect(
      computeActivityPhase({ ...DRAWN, canvasDrawn: false }, current),
    ).toBe('loading')
  })

  test('loading while the viewport is past loaded data', () => {
    expect(computeActivityPhase(DRAWN, () => false)).toBe('loading')
  })

  // A view below the fold: `ViewContainer` mounts no body, so there is no canvas
  // to paint and `canvasDrawn` can never flip. Reported as loading, one such
  // view parked `[data-app-phase="ready"]` for the whole app.
  describe('hostMounted', () => {
    const unmounted = { ...DRAWN, canvasDrawn: false }

    test('drops the pre-paint term for an unmounted host', () => {
      expect(computeActivityPhase(unmounted, current, () => false)).toBe(
        'ready',
      )
    })

    // the fetch terms stay live, so a gate cannot fire over work in flight —
    // including during cold load, before the observer's first callback
    test('keeps the fetch term for an unmounted host', () => {
      expect(
        computeActivityPhase(
          { ...unmounted, isLoading: true },
          current,
          () => false,
        ),
      ).toBe('loading')
    })

    test('keeps the staleness term for an unmounted host', () => {
      expect(
        computeActivityPhase(
          unmounted,
          () => false,
          () => false,
        ),
      ).toBe('loading')
    })

    test('defaults to mounted, so a caller that omits it is unchanged', () => {
      expect(computeActivityPhase(unmounted, current)).toBe('loading')
    })
  })

  // LD with the triangle off: it renders a static placeholder, never paints a
  // canvas, so `canvasDrawn` can never flip. Without the gate the scrim sits
  // over that placeholder permanently.
  test('rendersCanvas: false drops the pre-paint term only', () => {
    expect(
      computeActivityPhase(
        { ...DRAWN, rendersCanvas: false, canvasDrawn: false },
        current,
      ),
    ).toBe('ready')
    expect(
      computeActivityPhase(
        {
          ...DRAWN,
          rendersCanvas: false,
          canvasDrawn: false,
          isLoading: true,
        },
        current,
      ),
    ).toBe('loading')
  })

  // A standing user cancel is finished, not pending: it answers `canceled`
  // whatever the loading terms say, since they wait on the fetch it stopped.
  describe('fetchCanceled', () => {
    test('a cancel over drawn, current data is canceled', () => {
      expect(
        computeActivityPhase({ ...DRAWN, fetchCanceled: true }, current),
      ).toBe('canceled')
    })

    test.each([
      ['before first paint', { ...DRAWN, canvasDrawn: false }, current],
      ['over stale data', DRAWN, () => false],
      [
        'with a dependent load outstanding',
        { ...DRAWN, awaitingDependentData: true },
        current,
      ],
    ])('outranks every loading term: %s', (_label, inputs, viewport) => {
      expect(
        computeActivityPhase({ ...inputs, fetchCanceled: true }, viewport),
      ).toBe('canceled')
    })

    test('does not read the viewport', () => {
      const viewportCurrent = jest.fn(() => false)
      computeActivityPhase({ ...DRAWN, fetchCanceled: true }, viewportCurrent)
      expect(viewportCurrent).not.toHaveBeenCalled()
    })
  })

  // Sequence past base resolution: a static "zoom in" message, no fetch. Unlike
  // rendersCanvas this outranks every term, including an in-flight fetch and a
  // standing cancel.
  test('fetchInert outranks every other term', () => {
    expect(
      computeActivityPhase(
        {
          isMinimized: false,
          fetchInert: true,
          viewportEmpty: false,
          isLoading: true,
          fetchCanceled: true,
          awaitingDependentData: false,
          rendersCanvas: true,
          canvasDrawn: false,
        },
        () => false,
      ),
    ).toBe('ready')
  })

  test('isMinimized outranks every other term', () => {
    expect(
      computeActivityPhase(
        {
          isMinimized: true,
          fetchInert: false,
          viewportEmpty: false,
          isLoading: true,
          fetchCanceled: true,
          awaitingDependentData: true,
          rendersCanvas: true,
          canvasDrawn: false,
        },
        () => false,
        () => true,
      ),
    ).toBe('ready')
  })

  // A viewport holding no content block — `showAllRegions` on a region set
  // whose every member elides. No fetch is issued there, so `canvasDrawn` never
  // flips and the pre-paint term alone would scrim the display for as long as
  // the viewport stays off content.
  test('viewportEmpty outranks every other term', () => {
    expect(
      computeActivityPhase(
        {
          isMinimized: false,
          fetchInert: false,
          viewportEmpty: true,
          isLoading: true,
          fetchCanceled: true,
          awaitingDependentData: false,
          rendersCanvas: true,
          canvasDrawn: false,
        },
        () => false,
      ),
    ).toBe('ready')
  })

  // The viewport read is the only one that reaches the containing view, so it
  // must stay behind the short-circuit — a suppressed or already-loading display
  // subscribing to visibleRegions/loadedRegions churn is the hazard
  // computeDisplayPhase's own `activity` thunk exists to avoid.
  test.each([
    ['minimized', { ...DRAWN, isMinimized: true }],
    ['suppressed', { ...DRAWN, fetchInert: true }],
    ['off content', { ...DRAWN, viewportEmpty: true }],
    ['already loading', { ...DRAWN, isLoading: true }],
    ['pre-first-paint', { ...DRAWN, canvasDrawn: false }],
  ])('does not read the viewport when %s', (_label, inputs) => {
    const viewportCurrent = jest.fn(() => true)
    computeActivityPhase(inputs, viewportCurrent)
    expect(viewportCurrent).not.toHaveBeenCalled()
  })
})

// The two LGV display foundations hand-wrote this term until it was hoisted
// here, and it was a boolean until `canceled` split out of it. These re-derive
// each family's old expression from the same inputs and pin that the phase is
// that expression with only the cancel renamed: `loading` wherever it was true
// and no cancel stood, `canceled` wherever a cancel stood and it was true, and
// `ready` exactly where it was false.
describe('computeActivityPhase matches the expressions it replaced', () => {
  const bools = [false, true]
  const cases = bools.flatMap(fetchInert =>
    bools.flatMap(isLoading =>
      bools.flatMap(fetchCanceled =>
        bools.flatMap(canvasDrawn =>
          bools.flatMap(rendersCanvas =>
            bools.map(viewportWithinLoadedData => ({
              fetchInert,
              isLoading,
              fetchCanceled,
              canvasDrawn,
              rendersCanvas,
              viewportWithinLoadedData,
            })),
          ),
        ),
      ),
    ),
  )
  const asPhase = (before: boolean, fetchCanceled: boolean) =>
    !before ? 'ready' : fetchCanceled ? 'canceled' : 'loading'

  test.each(cases)('per-region parity %o', c => {
    // MultiRegionDisplayMixin, before the hoist:
    //   !fetchInert && (!isReady || !viewportWithinLoadedData || fetchCanceled)
    // with isReady = canvasDrawn && !isLoading
    const isReady = c.canvasDrawn && !c.isLoading
    const before =
      !c.fetchInert &&
      (!isReady || !c.viewportWithinLoadedData || c.fetchCanceled)
    expect(
      computeActivityPhase(
        {
          isMinimized: false,
          fetchInert: c.fetchInert,
          viewportEmpty: false,
          isLoading: c.isLoading,
          fetchCanceled: c.fetchCanceled,
          awaitingDependentData: false,
          canvasDrawn: c.canvasDrawn,
          rendersCanvas: true,
        },
        () => c.viewportWithinLoadedData,
      ),
    ).toBe(asPhase(before, c.fetchCanceled))
  })

  test.each(cases)('global parity %o', c => {
    // the global foundation, before the hoist:
    //   isLoadingOrCanceled || (rendersCanvas && !canvasDrawn)
    const before =
      c.isLoading || c.fetchCanceled || (c.rendersCanvas && !c.canvasDrawn)
    expect(
      computeActivityPhase(
        {
          isMinimized: false,
          fetchInert: false,
          viewportEmpty: false,
          isLoading: c.isLoading,
          fetchCanceled: c.fetchCanceled,
          awaitingDependentData: false,
          canvasDrawn: c.canvasDrawn,
          rendersCanvas: c.rendersCanvas,
        },
        () => true,
      ),
    ).toBe(asPhase(before, c.fetchCanceled))
  })
})
