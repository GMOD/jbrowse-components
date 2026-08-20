/* eslint-disable @typescript-eslint/no-floating-promises */
import { types } from '@jbrowse/mobx-state-tree'

import FetchMixin from './FetchMixin.ts'
import { callEachRegion } from './MultiRegionDisplayMixin.ts'

import type { FetchContext } from './FetchMixin.ts'
import type { Region } from '@jbrowse/core/util'

const REGION = {
  refName: 'ctgA',
  start: 0,
  end: 100,
  assemblyName: 'volvox',
} as Region

// FetchMixin logs console.error on non-abort failures; silence it here since
// error-path tests deliberately trigger these
beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => jest.restoreAllMocks())

const TestModel = types.compose('Test', FetchMixin(), types.model({}))

function makeModel() {
  return TestModel.create({})
}

// Resolves on the next microtask tick. Used to let the runFetch flow
// finish its post-await work so we can assert on it.
function tick() {
  return Promise.resolve()
}

describe('FetchMixin: lifecycle state', () => {
  it('starts not loading, no error, no status', () => {
    const m = makeModel()
    expect(m.isLoading).toBe(false)
    expect(m.error).toBeUndefined()
    expect(m.statusMessage).toBeUndefined()
    expect(m.fetchGeneration).toBe(0)
    expect(m.activeStopToken).toBeUndefined()
  })

  it('isLoading flips true while runFetch is in flight, false after', async () => {
    const m = makeModel()
    let resolve!: () => void
    const work = (_ctx: FetchContext) =>
      new Promise<void>(r => {
        resolve = r
      })
    m.runFetch(work)
    expect(m.isLoading).toBe(true)
    resolve()
    await tick()
    await tick()
    expect(m.isLoading).toBe(false)
  })

  it('clears prior error at the start of a new fetch', async () => {
    const m = makeModel()
    m.setError(new Error('prior'))
    expect(m.error).toBeDefined()
    m.runFetch(async () => {})
    // Synchronously cleared at flow start (before any yield).
    expect(m.error).toBeUndefined()
    await tick()
    await tick()
  })
})

describe('FetchMixin: error handling', () => {
  it('records non-abort errors when not stale', async () => {
    const m = makeModel()
    const failure = new Error('boom')
    m.runFetch(() => Promise.reject(failure))
    await tick()
    await tick()
    expect(m.error).toBe(failure)
    expect(m.isLoading).toBe(false)
  })

  it('swallows abort exceptions (does not set error)', async () => {
    const m = makeModel()
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' })
    m.runFetch(() => Promise.reject(abortErr))
    await tick()
    await tick()
    expect(m.error).toBeUndefined()
  })

  it('does not record error if fetch became stale before completing', async () => {
    const m = makeModel()
    let reject!: (e: unknown) => void
    m.runFetch(
      () =>
        new Promise<void>((_resolve, r) => {
          reject = r
        }),
    )
    // Cancel mid-flight, then reject. cancelFetch bumps fetchGeneration so
    // isStale() returns true in the flow's catch block — error stays
    // undefined.
    m.cancelFetch()
    reject(new Error('boom'))
    await tick()
    await tick()
    expect(m.error).toBeUndefined()
  })
})

describe('FetchMixin: cancellation', () => {
  it('cancelFetch on idle still bumps fetchGeneration (callers rely on this)', () => {
    const m = makeModel()
    const before = m.fetchGeneration
    m.cancelFetch()
    expect(m.fetchGeneration).toBe(before + 1)
  })

  it('cancelFetch mid-flight clears stop token, bumps signal, isLoading=false', () => {
    const m = makeModel()
    m.runFetch(() => new Promise<void>(() => {})) // never resolves
    expect(m.isLoading).toBe(true)
    const before = m.fetchGeneration
    m.cancelFetch()
    expect(m.isLoading).toBe(false)
    expect(m.fetchGeneration).toBe(before + 1)
    expect(m.activeStopToken).toBeUndefined()
  })

  it('starting a new runFetch cancels the prior in-flight one', async () => {
    const m = makeModel()
    let firstRejected = false
    m.runFetch(ctx => {
      // Detect cancellation via stopToken aborted state. We can also
      // observe staleness — easier: simply yield an unresolved promise
      // and assert that the second fetch took over.
      return new Promise<void>((_resolve, reject) => {
        // Use a microtask check on isStale:
        void Promise.resolve().then(() => {
          if (ctx.isStale()) {
            firstRejected = true
            reject(new Error('cancelled'))
          }
        })
      })
    })
    const firstToken = m.activeStopToken
    m.runFetch(async () => {})
    expect(m.activeStopToken).not.toBe(firstToken)
    await tick()
    await tick()
    await tick()
    expect(firstRejected).toBe(true)
    expect(m.error).toBeUndefined() // first's rejection was swallowed
  })
})

describe('FetchMixin: user cancel + retry', () => {
  it('cancelFetchByUser stops the fetch and sets a durable fetchCanceled flag', () => {
    const m = makeModel()
    m.runFetch(() => new Promise<void>(() => {})) // never resolves
    expect(m.isLoading).toBe(true)
    m.cancelFetchByUser()
    expect(m.isLoading).toBe(false)
    expect(m.fetchCanceled).toBe(true)
    expect(m.activeStopToken).toBeUndefined()
  })

  it('cancelFetchByUser does NOT bump fetchGeneration (so autoruns do not restart)', () => {
    const m = makeModel()
    m.runFetch(() => new Promise<void>(() => {}))
    const before = m.fetchGeneration
    m.cancelFetchByUser()
    expect(m.fetchGeneration).toBe(before)
  })

  it('a new runFetch clears fetchCanceled (the retry path)', async () => {
    const m = makeModel()
    m.runFetch(() => new Promise<void>(() => {}))
    m.cancelFetchByUser()
    expect(m.fetchCanceled).toBe(true)
    m.runFetch(async () => {})
    expect(m.fetchCanceled).toBe(false)
    await tick()
    await tick()
  })

  it('internal cancelFetch clears fetchCanceled (it is a retrigger, not a stop)', () => {
    const m = makeModel()
    m.runFetch(() => new Promise<void>(() => {}))
    m.cancelFetchByUser()
    expect(m.fetchCanceled).toBe(true)
    m.cancelFetch()
    expect(m.fetchCanceled).toBe(false)
  })
})

describe('FetchMixin: fetchGeneration bump semantics', () => {
  it('bumps once on successful completion', async () => {
    const m = makeModel()
    const before = m.fetchGeneration
    m.runFetch(async () => {})
    // Not yet bumped (start does not bump).
    expect(m.fetchGeneration).toBe(before)
    await tick()
    await tick()
    expect(m.fetchGeneration).toBe(before + 1)
  })

  it('bumps once on errored completion', async () => {
    const m = makeModel()
    const before = m.fetchGeneration
    m.runFetch(() => Promise.reject(new Error('x')))
    expect(m.fetchGeneration).toBe(before)
    await tick()
    await tick()
    expect(m.fetchGeneration).toBe(before + 1)
  })

  it('bumps once on cancellation, not again when the cancelled flow finally runs', async () => {
    const m = makeModel()
    const before = m.fetchGeneration
    let resolve!: () => void
    m.runFetch(() => new Promise<void>(r => (resolve = r)))
    m.cancelFetch()
    expect(m.fetchGeneration).toBe(before + 1)
    resolve()
    await tick()
    await tick()
    // The flow's finally sees isStale()=true and skips its bump.
    expect(m.fetchGeneration).toBe(before + 1)
  })
})

describe('FetchMixin: status message', () => {
  it('plugin can set status during fetch; cleared on completion', async () => {
    const m = makeModel()
    let setStatusFromWork: (() => void) | undefined
    let resolve!: () => void
    m.runFetch(async () => {
      m.setStatusMessage('working...')
      setStatusFromWork = () => {
        m.setStatusMessage('almost done')
      }
      await new Promise<void>(r => (resolve = r))
    })
    await tick()
    expect(m.statusMessage).toBe('working...')
    setStatusFromWork!()
    expect(m.statusMessage).toBe('almost done')
    resolve()
    await tick()
    await tick()
    expect(m.statusMessage).toBeUndefined()
  })

  it('cancelFetch clears status message when there was an active fetch', () => {
    const m = makeModel()
    m.runFetch(() => new Promise<void>(() => {}))
    m.setStatusMessage('working...')
    m.cancelFetch()
    expect(m.statusMessage).toBeUndefined()
  })
})

// Driven through the per-region contexts a real fetch hands out
// (`callEachRegion`), not through a keyed setter called by hand — the retirement
// value a region actually sends is `''`, the `updateStatus`/`downloadStatus`
// phase clear, and nothing in production ever passed `undefined`. Tests written
// against the setter agreed with themselves and with nothing else.
describe('FetchMixin: progress reporting', () => {
  // the bar write is throttled, so these aggregation tests step the clock past
  // the window before each status; otherwise a synchronous burst is thinned and
  // the assertions read a deliberately-skipped value. Starts well past the
  // window so the first write in each test always lands.
  let clock = 1_000_000
  beforeEach(() => {
    clock = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => clock)
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })
  function step() {
    clock += 1000
  }

  // Two regions' worth of contexts from one fetch, as `callEachRegion` builds
  // them. Left in flight deliberately: these are about what the bar reads while
  // the fetch is running.
  function twoRegions() {
    const m = makeModel()
    const ctxs: FetchContext[] = []
    m.runFetch(ctx => {
      // `call` runs synchronously inside `callEachRegion`'s map, so the slots
      // exist by the time runFetch's first yield returns here
      void callEachRegion(
        [
          { region: REGION, displayedRegionIndex: 0 },
          { region: REGION, displayedRegionIndex: 1 },
        ],
        ctx,
        (_region, regionCtx) => {
          ctxs.push(regionCtx)
          return new Promise<void>(() => {})
        },
      )
      return new Promise<void>(() => {})
    })
    return { m, ctxs }
  }

  it('setStatusMessage splits a determinate status into message + fraction', () => {
    const m = makeModel()
    m.setStatusMessage({ message: 'Downloading', current: 1, total: 4 })
    expect(m.statusMessage).toBe('Downloading')
    expect(m.statusProgress).toBe(0.25)
  })

  it('setStatusMessage leaves progress undefined for an indeterminate status', () => {
    const m = makeModel()
    m.setStatusMessage('Processing')
    expect(m.statusMessage).toBe('Processing')
    expect(m.statusProgress).toBeUndefined()
  })

  it('aggregates concurrent regions into one bar', () => {
    const { m, ctxs } = twoRegions()
    const [a, b] = ctxs
    // two regions downloading in parallel: the bar reflects Σcurrent/Σtotal,
    // not whichever region reported last
    a!.statusCallback({ message: 'Downloading', current: 30, total: 100 })
    step()
    b!.statusCallback({ message: 'Downloading', current: 10, total: 100 })
    expect(m.statusMessage).toBe('Downloading')
    expect(m.statusProgress).toBeCloseTo(0.2)
  })

  // A region's phase clear means its work is DONE, so it is charged in full to
  // both halves of the fraction. The two readings this is not: charged at its
  // last in-flight number (50/200, no movement at all for work that completed),
  // or dropped outright — which loses the denominator too, and is what made the
  // bar run backwards as a batch landed.
  it("a region's phase clear charges it as complete", () => {
    const { m, ctxs } = twoRegions()
    const [a, b] = ctxs
    a!.statusCallback({ message: 'Downloading', current: 50, total: 100 })
    step()
    b!.statusCallback({ message: 'Downloading', current: 0, total: 100 })
    expect(m.statusProgress).toBeCloseTo(0.25)
    step()
    b!.statusCallback('')
    expect(m.statusProgress).toBeCloseTo(0.75)
  })

  // A region reporting no total is still a region in flight, so it is charged
  // the mean of the totals we know — a fan-out where one response carried no
  // Content-Length otherwise read 100% with that region still downloading.
  it('charges an indeterminate region rather than dropping it', () => {
    const { m, ctxs } = twoRegions()
    const [a, b] = ctxs
    a!.statusCallback({ message: 'Downloading', current: 100, total: 100 })
    step()
    b!.statusCallback('Downloading')
    expect(m.statusProgress).toBeCloseTo(0.5)
  })

  // A region between two phases and a region that is done look the same from the
  // fan-out, so the last region retiring does not mean the fetch is over — and a
  // blank label is what the loading UI shows as "Loading", which is the flap two
  // regions crossing a phase boundary together produced. The bar goes, the label
  // stays, and `runFetch`'s own `resetStatus` is what clears the field.
  it('drops the bar but holds the label when the last region finishes', () => {
    const { m, ctxs } = twoRegions()
    const [a, b] = ctxs
    a!.statusCallback({ message: 'Downloading', current: 1, total: 2 })
    step()
    a!.statusCallback('')
    b!.statusCallback('')
    expect(m.statusMessage).toBe('Downloading')
    expect(m.statusProgress).toBeUndefined()
    m.cancelFetch()
    expect(m.statusMessage).toBeUndefined()
  })

  // A phase clear is throttled like every other status (ADR-071), so a phase
  // that opens and closes inside one window moves the bar not at all. What still
  // has to hold is that the clear CANCELS the progress value queued behind it: a
  // percentage must never come back after the work it measured has ended.
  it('a phase clear cancels the progress value queued behind it', () => {
    jest.useFakeTimers()
    try {
      const { m, ctxs } = twoRegions()
      const [a] = ctxs
      a!.statusCallback({ message: 'Downloading', current: 1, total: 2 })
      expect(m.statusProgress).toBeCloseTo(0.5)
      // both land in the same window, so both are queued and only the newest
      // survives — the 9/10 is gone, not merely deferred
      a!.statusCallback({ message: 'Downloading', current: 9, total: 10 })
      a!.statusCallback('')
      expect(m.statusProgress).toBeCloseTo(0.5)
      step()
      jest.advanceTimersByTime(100)
      // the label survives the clear (the fetch is not over until runFetch says
      // so) but the percentage does not come back
      expect(m.statusMessage).toBe('Downloading')
      expect(m.statusProgress).toBeUndefined()
    } finally {
      jest.useRealTimers()
    }
  })

  it('a superseded fetch cannot repaint the bar', () => {
    const { m, ctxs } = twoRegions()
    const [a] = ctxs
    m.cancelFetch()
    step()
    a!.statusCallback({ message: 'Downloading', current: 1, total: 2 })
    expect(m.statusMessage).toBeUndefined()
    expect(m.statusProgress).toBeUndefined()
  })

  it('cancelFetch clears statusProgress', () => {
    const { m, ctxs } = twoRegions()
    const [a] = ctxs
    a!.statusCallback({ message: 'Downloading', current: 1, total: 2 })
    expect(m.statusProgress).toBeCloseTo(0.5)
    m.cancelFetch()
    expect(m.statusProgress).toBeUndefined()
  })
})

describe('FetchMixin: status callback throttle', () => {
  it('drops rapid callback updates within the 100ms window, applies the first', () => {
    const m = makeModel()
    const { statusCallback: cb } = m.openStatusStream(() => true)
    const now = jest.spyOn(Date, 'now')

    now.mockReturnValue(1000)
    cb({ message: 'Downloading', current: 1, total: 100 })
    expect(m.statusProgress).toBeCloseTo(0.01)

    // +50ms: inside the window, dropped, value unchanged
    now.mockReturnValue(1050)
    cb({ message: 'Downloading', current: 50, total: 100 })
    expect(m.statusProgress).toBeCloseTo(0.01)

    // +200ms from the last applied: past the window, applied
    now.mockReturnValue(1200)
    cb({ message: 'Downloading', current: 80, total: 100 })
    expect(m.statusProgress).toBeCloseTo(0.8)
  })

  it('passes updates spaced beyond the window through unthrottled', () => {
    const m = makeModel()
    const { statusCallback: cb } = m.openStatusStream(() => true)
    const now = jest.spyOn(Date, 'now')

    now.mockReturnValue(5000)
    cb('one')
    expect(m.statusMessage).toBe('one')

    now.mockReturnValue(5150)
    cb('two')
    expect(m.statusMessage).toBe('two')
  })

  // The window reopens when the field goes idle, which is what retiring the
  // last slot does — the owner no longer resets by hand around a fetch.
  it('the next operation after the last one retires reports immediately', () => {
    const m = makeModel()
    const first = m.openStatusStream(() => true)
    const now = jest.spyOn(Date, 'now')

    now.mockReturnValue(2000)
    first.statusCallback('first')
    expect(m.statusMessage).toBe('first')

    first.clear()
    expect(m.statusMessage).toBeUndefined()

    // only +50ms since the last write, but retiring the last slot reopened the
    // throttle
    now.mockReturnValue(2050)
    m.openStatusStream(() => true).statusCallback('after the lull')
    expect(m.statusMessage).toBe('after the lull')
  })
})

// A display runs more than one operation at a time — the viewport fetch, a
// bare-autorun fetch through a lent `createStopTokenRotation`, a clustering run
// — and all of them report into this one field. Before ADR-081 each of them
// blanked it outright when it finished, so whichever finished first wiped the
// label the others were still producing, and the loading overlay renders a
// missing label as its 'Loading' fallback.
describe('FetchMixin: two operations on one field', () => {
  // The shape `getMultiSampleVariantSourcesAutorun` and
  // `setupRunClusteringAutorun` both have: a second operation on a display that
  // is also fetching its viewport.
  function fetchAndSideOperation() {
    const m = makeModel()
    let fetchCtx!: FetchContext
    m.runFetch(ctx => {
      fetchCtx = ctx
      return new Promise<void>(() => {})
    })
    return { m, fetchCtx, side: m.openStatusStream(() => true) }
  }

  it('a side operation ending leaves the fetch label alone', () => {
    const { m, fetchCtx, side } = fetchAndSideOperation()
    fetchCtx.statusCallback('Downloading features')
    side.statusCallback('Reading sources')
    side.clear()
    expect(m.statusMessage).toBe('Downloading features')
  })

  it('the fetch ending leaves a side operation still running', async () => {
    const { m, side } = fetchAndSideOperation()
    side.statusCallback('Reading sources')
    m.cancelFetch()
    await tick()
    await tick()
    expect(m.statusMessage).toBe('Reading sources')
    // and the last one to retire is what blanks the field
    side.clear()
    expect(m.statusMessage).toBeUndefined()
  })

  // The same handover, with the throttle actually engaged — which is the state
  // it is in during any real fetch, since an RPC reports many times a second.
  // The write that moves the field off the fetch's label is the re-derive
  // `clear` queues, and it is a THROTTLED write, so a `statusWindow.reset()`
  // anywhere on the cancel path drops it and the display goes on showing a
  // label for work that has stopped. `reset` is for teardown, and `cancelFetch`
  // is what every `clearAllRpcData` runs.
  it('a cancel does not drop the sibling write queued behind the throttle', () => {
    jest.useFakeTimers()
    try {
      const { m, fetchCtx, side } = fetchAndSideOperation()
      // the fetch takes the leading edge, so what follows is queued rather than
      // landing at once
      fetchCtx.statusCallback('Downloading features')
      expect(m.statusMessage).toBe('Downloading features')
      side.statusCallback('Reading sources')
      expect(m.statusMessage).toBe('Downloading features')

      m.cancelFetch()
      jest.advanceTimersByTime(500)

      expect(m.statusMessage).toBe('Reading sources')
      side.clear()
    } finally {
      jest.useRealTimers()
    }
  })

  // Only one phase is summable (ADR-072), so what a two-operation aggregate
  // does is pick: the phase the display reached first holds the label, and the
  // bar under it is that phase's own.
  it('the earlier phase holds the label while both are reporting', () => {
    const { m, fetchCtx, side } = fetchAndSideOperation()
    fetchCtx.statusCallback({
      message: 'Downloading features',
      current: 1,
      total: 4,
    })
    side.statusCallback({ message: 'Reading sources', current: 1, total: 2 })
    expect(m.statusMessage).toBe('Downloading features')
    side.clear()
  })

  // The slot goes with the operation, so a display that keeps fetching for
  // hours does not accumulate them — and the phase order it recorded is dropped
  // with the last of them, since idle is the batch boundary.
  it('retiring the last slot blanks the field', () => {
    const { m, fetchCtx, side } = fetchAndSideOperation()
    fetchCtx.statusCallback('Downloading features')
    side.clear()
    m.cancelFetch()
    expect(m.statusMessage).toBeUndefined()
  })
})

describe('FetchMixin: isStale contract for work callbacks', () => {
  it('isStale is false during a normal fetch', async () => {
    const m = makeModel()
    let observedDuringWork = true
    m.runFetch(async ctx => {
      observedDuringWork = ctx.isStale()
    })
    await tick()
    await tick()
    expect(observedDuringWork).toBe(false)
  })

  it('isStale becomes true after cancelFetch is called mid-flight', async () => {
    const m = makeModel()
    let staleSnapshot: boolean | undefined
    let resolve!: () => void
    m.runFetch(async ctx => {
      await new Promise<void>(r => (resolve = r))
      staleSnapshot = ctx.isStale()
    })
    m.cancelFetch()
    resolve()
    await tick()
    await tick()
    expect(staleSnapshot).toBe(true)
  })

  it('isStale becomes true when a new runFetch supersedes the old', async () => {
    const m = makeModel()
    let staleSnapshot: boolean | undefined
    let resolve!: () => void
    m.runFetch(async ctx => {
      await new Promise<void>(r => (resolve = r))
      staleSnapshot = ctx.isStale()
    })
    m.runFetch(async () => {})
    resolve()
    await tick()
    await tick()
    await tick()
    expect(staleSnapshot).toBe(true)
  })
})

// Every fetch's context carries this display's status callback, so a helper
// holding only a ctx -- `byteGateBlocksFetch`, `fetchEachRegion` -- can report
// progress without reaching back into the model for it. It is a REQUIRED field
// on FetchContext for that reason: `runFetch` is the only producer, and a
// helper narrowing its parameter to a subset of the context is what dropped the
// byte-gate pre-flight's token and status in the first place.
describe('FetchMixin: the context status callback', () => {
  it('writes the display status through the ctx callback', async () => {
    const m = makeModel()
    await m.runFetch(async ctx => {
      ctx.statusCallback({ message: 'Downloading', current: 1, total: 4 })
      expect(m.statusMessage).toBe('Downloading')
      expect(m.statusProgress).toBe(0.25)
    })
  })

  it('is inert once the fetch that owns it is torn down', async () => {
    const m = makeModel()
    let captured!: FetchContext
    await m.runFetch(async ctx => {
      captured = ctx
    })
    // resetStatus already ran in runFetch's finally, so a late status from the
    // finished fetch must not put a label back on an idle display
    captured.statusCallback('Downloading')
    expect(m.statusMessage).toBeUndefined()
  })
})
