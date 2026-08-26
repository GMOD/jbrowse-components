import { act } from '@testing-library/react'

/**
 * Watch the console for the two severities of an ADR-069 violation.
 *
 * Taking a node out of a session by destroying it in place, inside an action,
 * gives everything mounted over it a final run against a dead tree — MobX runs
 * an action's pending reactions at the `endBatch` closing it. What that read
 * produces depends on what it lands on, and the two outcomes are one bug at two
 * severities, so they are bucketed apart:
 *
 * - a scalar or a reference **warns** (`no longer part of a state tree`)
 * - a walk **throws**. A display's reads reach `getContainingView`, which walks
 *   parents and throws where the session cases warn, and React's dev-mode props
 *   diff can reach a child node never materialized, which throws out of
 *   `createObservableInstance`. Those are what took the page down in #5616 /
 *   #5618 and on `cancer_sv/multihop_split_view`.
 *
 * Every argument is scanned, not just the first: MobX reports an uncaught error
 * in a reaction as `console.error(message, error)`, so a first-argument-only
 * filter buckets the throw as ordinary noise and prints it.
 */
export function captureTeardownNoise() {
  const deadReads: string[] = []
  const thrown: string[] = []
  const origWarn = console.warn
  const origError = console.error
  const capture =
    (passthrough: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      const text = args
        .map(a => (a instanceof Error ? a.stack || a.message : `${a}`))
        .join(' ')
      if (text.includes('no longer part of a state tree')) {
        deadReads.push(text.split('\n')[0]!)
      } else if (
        text.includes('no containing view found') ||
        text.includes('no session model found') ||
        text.includes('node does not have parent') ||
        // findParentThat's own warning, logged on the line above that throw. It
        // is the only trace left when the throw is stored in a computed nobody
        // reads again, which is what happens when the same action also unmounts
        // the component that would have read it.
        text.includes('[findParentThat] node has no parent') ||
        // #5618's throw, out of createObservableInstance on a child node that was
        // never materialized
        text.includes('initializing phase')
      ) {
        thrown.push(text.split('\n')[0]!)
      } else {
        passthrough(...(args as []))
      }
    }
  // each channel keeps its own passthrough: routing both to `console.warn`
  // printed every unrecognized ERROR as a warning, and stepped over a
  // `jest.spyOn(console, 'error')` a suite had installed to take one
  console.warn = capture(origWarn)
  console.error = capture(origError)
  return {
    deadReads,
    thrown,
    restore() {
      console.warn = origWarn
      console.error = origError
    },
  }
}

/**
 * Run `fn` and collect the noise from it and from the reaction flush closing
 * it, and deliberately not from the deferred teardown after — the same line
 * `sessionSwitchTeardown` draws, for the same reason. That window is the one
 * that matters and the one that is deterministic: components are still mounted
 * over the tree there, so a read is a read of something being rendered.
 * Destroying the detached tree afterwards still produces a couple, because
 * killing an MST tree invalidates computeds inside it that something is
 * observing; asserting zero there would promise what this design does not give.
 * The synchronous `act` is what draws the line — it flushes React and MobX but
 * not the `setTimeout(0)`.
 */
export function measure(fn: () => void) {
  const log = captureTeardownNoise()
  try {
    act(fn)
  } finally {
    log.restore()
  }
  return log
}

/**
 * Hold the same watch for a whole suite, so the DEFERRED teardown's noise stops
 * printing.
 *
 * `scheduleDetachedDestroy` frees a detached tree a task later, and MobX runs
 * the reactions that destroy invalidates at the `endBatch` closing it — so a
 * component still observing a computed inside that tree reads it once more
 * after it dies. ADR-069 accepts that: the window `measure` covers is the one
 * where something is being rendered, and it is the one asserted to be silent.
 * What comes after is a design cost with nothing to fix, and a suite that
 * prints it every run reads as a broken one.
 *
 * Suite-scoped rather than a message added to `config/jest/console.js`: the
 * literal is MST's and turns up wherever anything reads a dead node, so a
 * global filter would swallow the next real one too. The suites that install
 * this are the ones that take a tree out on purpose.
 */
export function suppressTeardownNoise() {
  let log: ReturnType<typeof captureTeardownNoise> | undefined
  beforeEach(() => {
    log = captureTeardownNoise()
  })
  afterEach(() => {
    log?.restore()
    log = undefined
  })
}
