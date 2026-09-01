import { computeDisplayPhase, computeLoadingTerm } from './displayPhase.ts'

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

  test('loading when the loading thunk is true', () => {
    expect(computeDisplayPhase(NONE, () => true)).toBe('loading')
  })

  test('ready when nothing terminal and not loading', () => {
    expect(computeDisplayPhase(NONE, () => false)).toBe('ready')
  })
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
    const loading = jest.fn(() => true)
    computeDisplayPhase(inputs, loading)
    expect(loading).not.toHaveBeenCalled()
  })

  test('calls loading thunk only once when no terminal flag is set', () => {
    const loading = jest.fn(() => false)
    computeDisplayPhase(NONE, loading)
    expect(loading).toHaveBeenCalledTimes(1)
  })
})

// A drawn, idle, viewport-current display: `computeLoadingTerm` returns false
// here, so each test below flips exactly one input and asserts it alone raises
// the scrim.
const DRAWN = {
  fetchInert: false,
  viewportEmpty: false,
  isLoadingOrCanceled: false,
  awaitingDependentData: false,
  rendersCanvas: true,
  canvasDrawn: true,
}
const current = () => true

describe('computeLoadingTerm', () => {
  test('a dependent load that has not first landed is loading', () => {
    expect(
      computeLoadingTerm({ ...DRAWN, awaitingDependentData: true }, current),
    ).toBe(true)
  })

  test('not loading once drawn, idle and viewport-current', () => {
    expect(computeLoadingTerm(DRAWN, current)).toBe(false)
  })

  test('loading while a fetch is in flight', () => {
    expect(
      computeLoadingTerm({ ...DRAWN, isLoadingOrCanceled: true }, current),
    ).toBe(true)
  })

  test('loading before the first paint', () => {
    expect(computeLoadingTerm({ ...DRAWN, canvasDrawn: false }, current)).toBe(
      true,
    )
  })

  test('loading while the viewport is past loaded data', () => {
    expect(computeLoadingTerm(DRAWN, () => false)).toBe(true)
  })

  // A view below the fold: `ViewContainer` mounts no body, so there is no canvas
  // to paint and `canvasDrawn` can never flip. Reported as loading, one such
  // view parked `[data-app-phase="ready"]` for the whole app.
  describe('hostMounted', () => {
    const unmounted = { ...DRAWN, canvasDrawn: false }

    test('drops the pre-paint term for an unmounted host', () => {
      expect(computeLoadingTerm(unmounted, current, () => false)).toBe(false)
    })

    // the fetch terms stay live, so a gate cannot fire over work in flight —
    // including during cold load, before the observer's first callback
    test('keeps the fetch term for an unmounted host', () => {
      expect(
        computeLoadingTerm(
          { ...unmounted, isLoadingOrCanceled: true },
          current,
          () => false,
        ),
      ).toBe(true)
    })

    test('keeps the staleness term for an unmounted host', () => {
      expect(
        computeLoadingTerm(
          unmounted,
          () => false,
          () => false,
        ),
      ).toBe(true)
    })

    test('defaults to mounted, so a caller that omits it is unchanged', () => {
      expect(computeLoadingTerm(unmounted, current)).toBe(true)
    })
  })

  // LD with the triangle off: it renders a static placeholder, never paints a
  // canvas, so `canvasDrawn` can never flip. Without the gate the scrim sits
  // over that placeholder permanently.
  test('rendersCanvas: false drops the pre-paint term only', () => {
    expect(
      computeLoadingTerm(
        { ...DRAWN, rendersCanvas: false, canvasDrawn: false },
        current,
      ),
    ).toBe(false)
    expect(
      computeLoadingTerm(
        {
          ...DRAWN,
          rendersCanvas: false,
          canvasDrawn: false,
          isLoadingOrCanceled: true,
        },
        current,
      ),
    ).toBe(true)
  })

  // Sequence past base resolution: a static "zoom in" message, no fetch. Unlike
  // rendersCanvas this outranks every term, including an in-flight fetch.
  test('fetchInert outranks every other term', () => {
    expect(
      computeLoadingTerm(
        {
          fetchInert: true,
          viewportEmpty: false,
          isLoadingOrCanceled: true,
          awaitingDependentData: false,
          rendersCanvas: true,
          canvasDrawn: false,
        },
        () => false,
      ),
    ).toBe(false)
  })

  // A viewport holding no content block — `showAllRegions` on a region set
  // whose every member elides. No fetch is issued there, so `canvasDrawn` never
  // flips and the pre-paint term alone would scrim the display for as long as
  // the viewport stays off content.
  test('viewportEmpty outranks every other term', () => {
    expect(
      computeLoadingTerm(
        {
          fetchInert: false,
          viewportEmpty: true,
          isLoadingOrCanceled: true,
          awaitingDependentData: false,
          rendersCanvas: true,
          canvasDrawn: false,
        },
        () => false,
      ),
    ).toBe(false)
  })

  // The viewport read is the only one that reaches the containing view, so it
  // must stay behind the short-circuit — a suppressed or already-loading display
  // subscribing to visibleRegions/loadedRegions churn is the hazard
  // computeDisplayPhase's own `loading` thunk exists to avoid.
  test.each([
    ['suppressed', { ...DRAWN, fetchInert: true }],
    ['off content', { ...DRAWN, viewportEmpty: true }],
    ['already loading', { ...DRAWN, isLoadingOrCanceled: true }],
    ['pre-first-paint', { ...DRAWN, canvasDrawn: false }],
  ])('does not read the viewport when %s', (_label, inputs) => {
    const viewportCurrent = jest.fn(() => true)
    computeLoadingTerm(inputs, viewportCurrent)
    expect(viewportCurrent).not.toHaveBeenCalled()
  })
})

// The two LGV display foundations hand-wrote this term until it was hoisted
// here. These pin that the hoist was behaviour-preserving, by re-deriving each
// family's old expression from the same inputs — so a future edit to
// computeLoadingTerm that changes either family's meaning fails here rather
// than in a screenshot.
describe('computeLoadingTerm matches the expressions it replaced', () => {
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

  test.each(cases)('per-region parity %o', c => {
    // MultiRegionDisplayMixin, before the hoist:
    //   !fetchInert && (!isReady || !viewportWithinLoadedData || fetchCanceled)
    // with isReady = canvasDrawn && !isLoading
    const isReady = c.canvasDrawn && !c.isLoading
    const before =
      !c.fetchInert &&
      (!isReady || !c.viewportWithinLoadedData || c.fetchCanceled)
    expect(
      computeLoadingTerm(
        {
          fetchInert: c.fetchInert,
          viewportEmpty: false,
          isLoadingOrCanceled: c.isLoading || c.fetchCanceled,
          awaitingDependentData: false,
          canvasDrawn: c.canvasDrawn,
          rendersCanvas: true,
        },
        () => c.viewportWithinLoadedData,
      ),
    ).toBe(before)
  })

  test.each(cases)('global parity %o', c => {
    // the global foundation, before the hoist:
    //   isLoadingOrCanceled || (rendersCanvas && !canvasDrawn)
    const isLoadingOrCanceled = c.isLoading || c.fetchCanceled
    const before = isLoadingOrCanceled || (c.rendersCanvas && !c.canvasDrawn)
    expect(
      computeLoadingTerm(
        {
          fetchInert: false,
          viewportEmpty: false,
          isLoadingOrCanceled,
          awaitingDependentData: false,
          canvasDrawn: c.canvasDrawn,
          rendersCanvas: c.rendersCanvas,
        },
        () => true,
      ),
    ).toBe(before)
  })
})
