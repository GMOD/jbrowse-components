import {
  comparativeDisplayPhase,
  comparativeSurfacePhase,
  comparativeSurfaceSettled,
} from './comparativeReadiness.ts'

// The two answers this module keeps apart. `comparativeDisplayPhase` is what
// AppReadyMarker counts — is this display still WORKING — and
// `comparativeSurfaceSettled` is what `data-display-drawn` publishes — is there
// FINISHED CONTENT here. They agree everywhere except on an error, and that
// disagreement is the point of the split.

const painted = {
  painted: true,
  initPending: false,
  pendingAutoDiagonalize: false,
}

const done = {
  error: undefined,
  fetchInert: false,
  loading: false,
  refetching: false,
  dataCurrent: true,
}

describe('comparativeDisplayPhase', () => {
  it('is ready once the surface has painted current data', () => {
    expect(comparativeDisplayPhase(done, painted)).toBe('ready')
  })

  it('is loading on a first fetch', () => {
    expect(
      comparativeDisplayPhase(
        { ...done, loading: true, dataCurrent: false },
        painted,
      ),
    ).toBe('loading')
  })

  it('is loading through a refetch over stale content', () => {
    expect(
      comparativeDisplayPhase(
        { ...done, refetching: true, dataCurrent: false },
        painted,
      ),
    ).toBe('loading')
  })

  // the state loading/refetching alone cannot see: the debounce gap after a
  // region or zoom change, where nothing is in flight and the held ribbons are
  // already stale
  it('is loading in the pre-refetch debounce gap', () => {
    expect(
      comparativeDisplayPhase({ ...done, dataCurrent: false }, painted),
    ).toBe('loading')
  })

  it('is loading until the shared canvas has painted', () => {
    expect(comparativeDisplayPhase(done, { ...painted, painted: false })).toBe(
      'loading',
    )
  })

  // Both are the view saying "what is on screen is not the answer yet" — an
  // init blob still being applied, and a reorder this init asked for that has
  // not landed. A display holding current data is still not showing one.
  it('is loading while the view is mid-init or mid-reorder', () => {
    expect(
      comparativeDisplayPhase(done, { ...painted, initPending: true }),
    ).toBe('loading')
    expect(
      comparativeDisplayPhase(done, {
        ...painted,
        pendingAutoDiagonalize: true,
      }),
    ).toBe('loading')
  })

  it('ranks an error above every loading term', () => {
    expect(
      comparativeDisplayPhase(
        { ...done, error: new Error('nope'), dataCurrent: false },
        { painted: false, initPending: true, pendingAutoDiagonalize: true },
      ),
    ).toBe('error')
  })

  // A minimized display, or a level whose two rows aren't both showing regions:
  // the fetch autorun never runs, so `dataCurrent` is false forever. Without
  // this the app would report itself loading for as long as the display existed.
  it('is ready when the fetch is inert, whatever the surface is doing', () => {
    expect(
      comparativeDisplayPhase(
        { ...done, fetchInert: true, dataCurrent: false },
        { painted: false, initPending: true, pendingAutoDiagonalize: true },
      ),
    ).toBe('ready')
  })
})

describe('comparativeSurfaceSettled', () => {
  it('is true once the surface has painted and every display is current', () => {
    expect(comparativeSurfaceSettled(painted, [done, done])).toBe(true)
  })

  it('is vacuously true on a surface with no displays', () => {
    // a level or axis that legitimately has no display; `initPending` covers
    // the window where init has yet to add them
    expect(comparativeSurfaceSettled(painted, [])).toBe(true)
    expect(
      comparativeSurfaceSettled({ ...painted, initPending: true }, []),
    ).toBe(false)
  })

  it('is false before first paint', () => {
    expect(
      comparativeSurfaceSettled({ ...painted, painted: false }, [done]),
    ).toBe(false)
  })

  // Deliberate, and the reason DiagonalizeProgressMixin raises the flag before
  // any render can paint: a capture times out rather than committing a picture
  // of the pre-reorder hairball.
  it('stays shut through a pending reorder', () => {
    expect(
      comparativeSurfaceSettled({ ...painted, pendingAutoDiagonalize: true }, [
        done,
      ]),
    ).toBe(false)
  })

  // THE DISAGREEMENT. An errored display has finished, so its phase is
  // terminal and the app reports itself ready — but an error banner is not
  // content, so this gate holds and the capture fails loudly instead of
  // regenerating a golden that shows the banner.
  it('holds shut on an error the display phase calls terminal', () => {
    const failed = { ...done, error: new Error('nope'), dataCurrent: false }
    expect(comparativeDisplayPhase(failed, painted)).toBe('error')
    expect(comparativeSurfaceSettled(painted, [failed])).toBe(false)
  })
})

// What the shared canvas publishes as `data-display-phase`. A canvas cannot
// carry one display's phase, so it carries the ranking over all of them — and
// before it carried anything, every DOM-level doneness wait on a comparative
// page was an assertion about a selector no element published.
describe('comparativeSurfacePhase', () => {
  it('is ready when every display is', () => {
    expect(comparativeSurfacePhase(painted, [done, done])).toBe('ready')
  })

  it('takes the loudest phase its displays report', () => {
    const busy = { ...done, loading: true, dataCurrent: false }
    const failed = { ...done, error: new Error('nope'), dataCurrent: false }
    expect(comparativeSurfacePhase(painted, [done, busy])).toBe('loading')
    expect(comparativeSurfacePhase(painted, [done, failed])).toBe('error')
    // an error outranks a fetch still running, since it is the thing a reader
    // most needs to see
    expect(comparativeSurfacePhase(painted, [busy, failed])).toBe('error')
  })

  // A level whose tracks init has yet to add is still assembling; one that
  // legitimately has none is done. Nothing else can answer for it — there is no
  // display to ask.
  it('answers an empty surface off initPending', () => {
    expect(comparativeSurfacePhase(painted, [])).toBe('ready')
    expect(comparativeSurfacePhase({ ...painted, initPending: true }, [])).toBe(
      'loading',
    )
  })
})
