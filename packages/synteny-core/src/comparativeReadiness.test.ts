import { displaysSettled } from './comparativeReadiness.ts'

// The `settled` half of both comparative views' done-gate. These pin the two
// properties the views depend on and that are easy to break together: a stale
// display is never done, and a display that will never fetch does not hold the
// whole view un-done on account of data that is not coming.
const busy = {
  isLoadingOrCanceled: false,
  dataCurrent: true,
  fetchInert: false,
}

describe('displaysSettled', () => {
  it('is vacuously true with no displays', () => {
    // a level or axis that legitimately has no display; the caller gates on
    // initPending for the case where init has yet to add them
    expect(displaysSettled([])).toBe(true)
  })

  it('is true once every display has current data and nothing in flight', () => {
    expect(displaysSettled([busy, busy])).toBe(true)
  })

  it('is false while a fetch is in flight', () => {
    expect(
      displaysSettled([
        busy,
        { ...busy, isLoadingOrCanceled: true, dataCurrent: false },
      ]),
    ).toBe(false)
  })

  it('is false over a load the user canceled', () => {
    // durable until Retry, and a capture presses nothing — the same reason an
    // error holds this gate shut below
    expect(
      displaysSettled([busy, { ...busy, isLoadingOrCanceled: true }]),
    ).toBe(false)
  })

  it('is false in the pre-refetch debounce gap', () => {
    // nothing in flight yet, but the held data no longer matches the viewport —
    // the state the loading flag alone cannot see
    expect(displaysSettled([{ ...busy, dataCurrent: false }])).toBe(false)
  })

  it('treats a fetch-inert display as settled', () => {
    // it can never set loadedFetchKey, so dataCurrent is false forever; without
    // this the view's `settled` gate (and the *_canvas_done testid screenshot
    // capture waits on) would never fire because of a display drawing nothing
    // by design
    expect(
      displaysSettled([
        busy,
        {
          isLoadingOrCanceled: false,
          dataCurrent: false,
          fetchInert: true,
        },
      ]),
    ).toBe(true)
  })
})
