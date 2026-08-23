import { isAlive, types } from '@jbrowse/mobx-state-tree'

import { makeAbortError } from './aborting.ts'
import { installFetch } from './installFetch.ts'
import { createStatusWindow, statusMessageText } from './progress.ts'

import type { FetchContext } from './fetchContext.ts'
import type { RpcStatus } from './progress.ts'

// Direct tests for the one fetch skeleton every fetch in the tree runs on,
// driven here in the shape a *secondary* fetch uses it — HiC's header read and
// the multi-sample sources scan. Each site used to hand-roll these rules and
// each copy was missing a different one, so what is pinned here is the rules —
// latest-wins, the currency-guarded error, the clear at the start, the
// unconditional reload read, the leading edge, the retired status slot —
// rather than any one display's use of them.

const DELAY = 40

// enough for the status window's 100ms throttle to deliver its trailing write
const THROTTLE_SETTLE_MS = 150

interface Deferred {
  promise: Promise<string | undefined>
  resolve: (v: string | undefined) => void
  reject: (e: unknown) => void
}

function deferred(): Deferred {
  let resolve!: (v: string | undefined) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<string | undefined>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// `setStatusMessage` is an action three steps down the chain, so it is not on
// `self` yet inside the volatile initializer — the same deferral `FetchMixin`
// makes for the same reason.
function writeStatus(self: unknown) {
  return (status: RpcStatus | undefined) => {
    const model = self as {
      setStatusMessage: (s?: RpcStatus) => void
    } & Parameters<typeof isAlive>[0]
    if (isAlive(model)) {
      model.setStatusMessage(status)
    }
  }
}

/**
 * A host carrying exactly the members `FetchSkeletonHost` declares, plus the
 * knobs a test drives it with. Deliberately not a real display: the skeleton
 * takes a duck-typed node, and booting one would put two plugins between each
 * rule and its assertion.
 */
function makeHost(opts?: { enabled?: boolean }) {
  const Host = types
    .model('PrerequisiteHost', {})
    .volatile(self => ({
      isMinimized: false,
      reloadCounter: 0,
      fetchInert: false,
      enabled: opts?.enabled ?? true,
      error: undefined as unknown,
      statusMessage: undefined as string | undefined,
      statusWindow: createStatusWindow(writeStatus(self)),
      /** every value `commit` has been handed, in order */
      committed: [] as string[],
      /** the pending promise of each `run` call, in order */
      runs: [] as Deferred[],
      contexts: [] as FetchContext[],
      /**
       * How many times the autorun body has reached the `enabled` gate — i.e.
       * how many times it re-ran, whether or not it went on to fetch. The
       * trigger-list rule is about the body re-running, so a decline has to be
       * observable on its own.
       *
       * Inside an object, like the two arrays above: the autorun body is not an
       * action, so a bare `self.bodyRuns += 1` is the write MST protects
       * against, while mutating what a volatile holds is not.
       */
      probe: { bodyRuns: 0 },
    }))
    .actions(self => ({
      setError(e?: unknown) {
        self.error = e
      },
      setStatusMessage(status?: RpcStatus) {
        self.statusMessage = statusMessageText(status)
      },
      setMinimized(v: boolean) {
        self.isMinimized = v
      },
      setEnabled(v: boolean) {
        self.enabled = v
      },
      reload() {
        self.reloadCounter += 1
      },
    }))
    // its own block: the skeleton's host type names `setError` and
    // `setStatusMessage`, and inside the block that declares them `self` does
    // not carry them yet — the same staging the real mixins use
    .actions(self => ({
      // `afterCreate`, not `afterAttach`: MST fires the latter on attachment to
      // a parent and this host is a root, which a display never is.
      afterCreate() {
        installFetch(self, {
          report: { statusWindow: self.statusWindow },
          gate: () => {
            self.probe.bodyRuns += 1
            return !self.isMinimized && self.enabled
          },
          // this fetch's inputs are the host's alone, so its args are empty —
          // `undefined` is reserved for the decline
          prepare: () => ({}),
          run: (_args, ctx) => {
            const d = deferred()
            self.runs.push(d)
            self.contexts.push(ctx)
            return d.promise
          },
          commit: value => {
            self.committed.push(value)
          },
          setError: e => {
            self.setError(e)
          },
          delay: DELAY,
          name: 'TestSecondaryFetch',
        })
      },
    }))
  return Host.create()
}

/** let the leading-edge microtask, and any settled promise, land */
async function flush() {
  for (let i = 0; i < 4; i++) {
    await Promise.resolve()
  }
}

/**
 * let the debounce fire, for the reruns that are no longer on the leading
 * edge — polls the predicate rather than sleeping a fixed multiple of
 * `DELAY`, because a loaded CI runner can push the `setTimeout` well past a
 * small fixed margin
 */
async function settleDebounce(predicate: () => boolean) {
  const deadline = Date.now() + 5000
  while (!predicate()) {
    if (Date.now() > deadline) {
      break
    }
    await new Promise(r => {
      setTimeout(r, DELAY)
    })
  }
}

function silenceErrorLog() {
  return jest.spyOn(console, 'error').mockImplementation(() => {})
}

test('the first run is on the leading edge, not after the debounce', async () => {
  const host = makeHost()
  expect(host.runs).toHaveLength(0)
  await flush()
  expect(host.runs).toHaveLength(1)
})

test('a resolved run commits its value', async () => {
  const host = makeHost()
  await flush()
  host.runs[0]!.resolve('header')
  await flush()
  expect(host.committed).toEqual(['header'])
  expect(host.error).toBeUndefined()
})

test('an undefined result commits nothing, and is not a failure', async () => {
  const host = makeHost()
  await flush()
  host.runs[0]!.resolve(undefined)
  await flush()
  expect(host.committed).toEqual([])
  expect(host.error).toBeUndefined()
})

// HiC's header read had no rotation at all, so two reload-overlapped reads
// committed in whatever order they happened to resolve.
test('a superseded run cannot commit behind the one that replaced it', async () => {
  const host = makeHost()
  await flush()
  host.reload()
  await settleDebounce(() => host.runs.length >= 2)
  expect(host.runs).toHaveLength(2)

  host.runs[1]!.resolve('fresh')
  await flush()
  host.runs[0]!.resolve('stale')
  await flush()

  expect(host.committed).toEqual(['fresh'])
})

// The sources fetch guarded its error publish on liveness but not currency, so
// a superseded run's teardown could overwrite the slot its successor owns.
test("a superseded run's failure does not publish over its successor", async () => {
  const spy = silenceErrorLog()
  const host = makeHost()
  await flush()
  host.reload()
  await settleDebounce(() => host.runs.length >= 2)

  host.runs[0]!.reject(new Error('superseded'))
  await flush()
  expect(host.error).toBeUndefined()

  host.runs[1]!.resolve('fresh')
  await flush()
  expect(host.committed).toEqual(['fresh'])
  expect(host.error).toBeUndefined()
  spy.mockRestore()
})

test('a current run publishes its failure', async () => {
  const spy = silenceErrorLog()
  const host = makeHost()
  await flush()
  host.runs[0]!.reject(new Error('boom'))
  await flush()
  expect(host.error).toEqual(new Error('boom'))
  spy.mockRestore()
})

test('an abort is the ordinary end of a run, not an error', async () => {
  const host = makeHost()
  await flush()
  host.runs[0]!.reject(makeAbortError())
  await flush()
  expect(host.error).toBeUndefined()
})

// The trigger list: `reloadCounter` is read above every gate, so Retry re-runs
// the body from a state where nothing else has moved — which after a failure is
// every state.
test('a reload re-runs the body when nothing else has moved', async () => {
  const spy = silenceErrorLog()
  const host = makeHost()
  await flush()
  host.runs[0]!.reject(new Error('boom'))
  await flush()
  expect(host.error).toBeDefined()

  host.reload()
  await settleDebounce(() => host.runs.length >= 2)
  expect(host.runs).toHaveLength(2)
  spy.mockRestore()
})

// The same rule from the state that actually breaks without it: a run that
// DECLINES rebuilds the autorun's dependency set from the reads it made before
// bailing out, so a `reloadCounter` read below the gate falls out of that set
// and can never wake the body again. Reading it unconditionally, above every
// gate, is what keeps Retry alive on a display that is declining.
test('a reload re-runs a body that declined', async () => {
  const host = makeHost({ enabled: false })
  await flush()
  expect(host.probe.bodyRuns).toBe(1)
  expect(host.runs).toHaveLength(0)

  host.reload()
  await settleDebounce(() => host.probe.bodyRuns >= 2)
  expect(host.probe.bodyRuns).toBe(2)
})

test('the `enabled` gate declines, and flipping it wakes the run', async () => {
  const host = makeHost({ enabled: false })
  await flush()
  expect(host.runs).toHaveLength(0)

  host.setEnabled(true)
  await flush()
  expect(host.runs).toHaveLength(1)
})

test('a minimized host does not run, and expanding wakes it', async () => {
  const host = makeHost()
  host.setMinimized(true)
  await flush()
  expect(host.runs).toHaveLength(0)

  host.setMinimized(false)
  await flush()
  expect(host.runs).toHaveLength(1)
})

// The clear-at-start rule: this runner re-fires on tracked reads that never
// pass through `reload()`'s own clear (un-minimize, an adapter-config edit), so
// a successful re-run must not leave the previous failure's banner standing
// over the result it just committed.
test('a retriggered run clears the previous failure at its start', async () => {
  const spy = silenceErrorLog()
  const host = makeHost()
  await flush()
  host.runs[0]!.reject(new Error('boom'))
  await flush()
  expect(host.error).toBeDefined()

  host.setMinimized(true)
  await flush()
  host.setMinimized(false)
  await settleDebounce(() => host.runs.length >= 2)
  expect(host.runs).toHaveLength(2)
  expect(host.error).toBeUndefined()

  host.runs[1]!.resolve('header')
  await flush()
  expect(host.committed).toEqual(['header'])
  expect(host.error).toBeUndefined()
  spy.mockRestore()
})

// `end()` in the run's `finally`, which the sources fetch had never had:
// `getSources` scans every feature in every region and reports for as long as
// that takes, so a failure partway left its last status standing and the
// background-progress chip rendering off it for good.
test('a failed run retires its status slot', async () => {
  const spy = silenceErrorLog()
  const host = makeHost()
  await flush()
  host.contexts[0]!.statusCallback('scanning')
  expect(host.statusMessage).toBe('scanning')

  host.runs[0]!.reject(new Error('boom'))
  await flush()
  await new Promise(r => {
    setTimeout(r, THROTTLE_SETTLE_MS)
  })
  expect(host.statusMessage).toBeUndefined()
  spy.mockRestore()
})
