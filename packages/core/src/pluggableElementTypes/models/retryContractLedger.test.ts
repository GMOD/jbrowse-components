// `makeRetryContractCheck`'s ledger, driven directly.
//
// Underneath the MobX and the two fetch foundations, the check is a small state
// machine: a `reloadCounter` bump is an outstanding retry, and each run's
// outcome either answers it, defers it, or is the dead button. Everything it
// reads it reads off the host object, so the host can be a plain object and the
// whole machine runs in microseconds — which is what makes it worth covering
// exhaustively here rather than through a real display. It sits beside the
// checker, which moved down to `@jbrowse/core` so all three fetch families
// could reach it; the wiring tests (which early return emits which outcome)
// stay where a real autorun runs, in
// `plugin-linear-genome-view`'s `installGlobalFetchAutorun.test.ts` for the
// global family and `gwas/LinearManhattanDisplay/retryContract.test.ts` for the
// per-region one.
//
// The distinction these pin, and the one that is easy to write and easy to get
// wrong, is **deferral vs exemption**. An exemption consumes the bump, so the
// display spends its retry on a decline it called preliminary and the run that
// should have answered has nothing left to answer. A deferral leaves the bump
// outstanding. Under a single bump the two behave differently; under two bumps
// they do not, which is why nothing below bumps twice to prove a deferral.

import { types } from '@jbrowse/mobx-state-tree'

import {
  makeRetryContractCheck,
  noteFetchStarted,
  takeFetchStarted,
} from './assertDisplayContract.ts'

import type { FetchAutorunOutcome } from './assertDisplayContract.ts'

// A real MST node, not a plain object: the report reads `getMembers(self).name`,
// so a bare object would make the check throw on its way to reporting and every
// `run()` below would come back the same whether the ledger worked or not. The
// node carries only what the check reads — no view, no session, no autorun.
const Host = types
  .model('RetryLedgerHost', {})
  .volatile(() => ({
    reloadCounter: 0,
    loadingSuppressed: false,
    awaitingPrerequisite: false,
  }))
  .actions(self => ({
    reload() {
      self.reloadCounter++
    },
    setLoadingSuppressed(flag: boolean) {
      self.loadingSuppressed = flag
    },
    setAwaitingPrerequisite(flag: boolean) {
      self.awaitingPrerequisite = flag
    },
  }))

type HostModel = ReturnType<typeof Host.create>

function makeHost(overrides: Partial<Record<string, boolean>> = {}) {
  const host = Host.create({})
  host.setLoadingSuppressed(!!overrides.loadingSuppressed)
  host.setAwaitingPrerequisite(!!overrides.awaitingPrerequisite)
  return host
}

// Reports land on `console.error`, which `config/jest/console.js` buffers and
// fails the test for if unclaimed — so a run that reports must be taken, and
// `true` here means exactly one report was on the channel.
function drive(host: HostModel) {
  const check = makeRetryContractCheck(host)
  return function run(outcome: FetchAutorunOutcome) {
    check(outcome)
    const taken = takeDisplayContractReports()
    if (taken.length > 1) {
      throw new Error(`one run produced ${taken.length} reports`)
    }
    if (taken.length === 1) {
      expect(taken[0]).toMatch(/Retry is a dead button/)
    }
    return taken.length === 1
  }
}

const OUTCOMES: FetchAutorunOutcome[] = [
  'fetched',
  'declined',
  'gated',
  'deferred',
]

describe('with no retry outstanding', () => {
  it.each(OUTCOMES)('%s reports nothing', outcome => {
    const host = makeHost()
    expect(drive(host)(outcome)).toBe(false)
  })

  // The counter is the entire difference between a retry and a pan. A display
  // whose gate declines on every idle run — arc after its data lands — would
  // otherwise report continuously and be turned off within a day.
  it('stays silent across a long run of declines', () => {
    const host = makeHost()
    const run = drive(host)
    for (let i = 0; i < 50; i++) {
      expect(run('declined')).toBe(false)
    }
  })
})

describe('with a retry outstanding', () => {
  it('reports a decline', () => {
    const host = makeHost()
    const run = drive(host)
    host.reload()
    expect(run('declined')).toBe(true)
  })

  it.each(['fetched', 'gated'] as const)(
    '%s answers it, and silently',
    outcome => {
      const host = makeHost()
      const run = drive(host)
      host.reload()
      expect(run(outcome)).toBe(false)
      // consumed: the next decline is not the retry's
      expect(run('declined')).toBe(false)
    },
  )

  // `gated` consuming is deliberate and worth pinning separately from the line
  // above, because the alternative is tempting: the too-large banner offers
  // Force load rather than Retry, so that run answers the bump legitimately, and
  // leaving it outstanding would land the report on whichever unrelated run
  // cleared the gate later.
  it('does not carry a gated bump forward to an unrelated decline', () => {
    const host = makeHost()
    const run = drive(host)
    host.reload()
    run('gated')
    for (let i = 0; i < 10; i++) {
      expect(run('declined')).toBe(false)
    }
  })

  it('reports only once, then stops', () => {
    const host = makeHost()
    const run = drive(host)
    host.reload()
    expect(run('declined')).toBe(true)
    expect(run('declined')).toBe(false)
  })

  it('reports again after a second bump', () => {
    const host = makeHost()
    const run = drive(host)
    host.reload()
    expect(run('declined')).toBe(true)
    host.reload()
    expect(run('declined')).toBe(true)
  })
})

describe('loadingSuppressed is an exemption', () => {
  it('waives the report', () => {
    const host = makeHost({ loadingSuppressed: true })
    const run = drive(host)
    host.reload()
    expect(run('declined')).toBe(false)
  })

  // The difference from `awaitingPrerequisite` below, and the reason both exist:
  // a display deliberately not fetching has answered its retry — there is
  // nothing coming later to judge. So the bump is spent.
  it('spends the bump, so a later decline is silent', () => {
    const host = makeHost({ loadingSuppressed: true })
    const run = drive(host)
    host.reload()
    expect(run('declined')).toBe(false)
    host.setLoadingSuppressed(false)
    expect(run('declined')).toBe(false)
  })

  // Read at report time, not at bump time: a display that starts fetching again
  // between the bump and the decline gets judged on what it is now.
  it('is read at the decline, not at the bump', () => {
    const host = makeHost({ loadingSuppressed: true })
    const run = drive(host)
    host.reload()
    host.setLoadingSuppressed(false)
    expect(run('declined')).toBe(true)
  })
})

describe('awaitingPrerequisite is a deferral', () => {
  it('holds the report while the prerequisite is out', () => {
    const host = makeHost({ awaitingPrerequisite: true })
    const run = drive(host)
    host.reload()
    expect(run('declined')).toBe(false)
  })

  // The whole point. One bump, and the run after the prerequisite lands is the
  // one judged — an exemption would have consumed the bump above and gone quiet
  // forever.
  it('leaves the bump outstanding for the run that follows', () => {
    const host = makeHost({ awaitingPrerequisite: true })
    const run = drive(host)
    host.reload()
    expect(run('declined')).toBe(false)
    host.setAwaitingPrerequisite(false)
    expect(run('declined')).toBe(true)
  })

  it('survives any number of preliminary declines', () => {
    const host = makeHost({ awaitingPrerequisite: true })
    const run = drive(host)
    host.reload()
    for (let i = 0; i < 20; i++) {
      expect(run('declined')).toBe(false)
    }
    host.setAwaitingPrerequisite(false)
    expect(run('declined')).toBe(true)
  })

  // A prerequisite that lands into a working fetch answers the retry the normal
  // way, and consumes it.
  it('a fetch after the deferral answers the retry', () => {
    const host = makeHost({ awaitingPrerequisite: true })
    const run = drive(host)
    host.reload()
    run('declined')
    host.setAwaitingPrerequisite(false)
    expect(run('fetched')).toBe(false)
    expect(run('declined')).toBe(false)
  })

  // It claims nothing about the other outcomes: only a decline can be
  // preliminary, so a `fetched` or `gated` run consumes the bump regardless.
  it.each(['fetched', 'gated'] as const)('does not intercept %s', outcome => {
    const host = makeHost({ awaitingPrerequisite: true })
    const run = drive(host)
    host.reload()
    run(outcome)
    host.setAwaitingPrerequisite(false)
    expect(run('declined')).toBe(false)
  })

  // **A predicate that is always true is an exemption, not a deferral**, and
  // this is the shape HiC is in — its predicate restates the negation of its own
  // gate, so every decline it can make is a deferred one and no run is ever
  // judged. Pinned here because it reads as coverage and is not: what covers
  // HiC's retry is `LinearHicDisplay/infoFetchFailure.test.ts`. A new call site
  // whose predicate is not strictly narrower than its gate has opted out.
  it('never reports at all when the predicate is always true', () => {
    const host = makeHost({ awaitingPrerequisite: true })
    const run = drive(host)
    for (let i = 0; i < 20; i++) {
      host.reload()
      expect(run('declined')).toBe(false)
    }
  })
})

// The second way in. Both fetch foundations classify their own autorun runs, but
// a `reload()` can reach a fetch with no autorun run in between — canvas's clears
// and calls `fetchNeeded` itself rather than waiting out the 600ms debounce — and
// by the time the autorun does run, the blocks are covered and it reads as a
// decline. So `FetchMixin.runFetch` answers the retry directly.
describe('a fetch answers the retry wherever it started', () => {
  it('consumes an outstanding bump, so the next decline is silent', () => {
    const host = makeHost()
    const run = drive(host)
    host.reload()
    noteFetchStarted(host)
    expect(run('declined')).toBe(false)
  })

  it('reports nothing on its own when no retry is outstanding', () => {
    const host = makeHost()
    drive(host)
    noteFetchStarted(host)
    noteFetchStarted(host)
    expect(takeDisplayContractReports()).toEqual([])
  })

  // A fetch is the thing the retry asked for, so it beats the deferral: there is
  // nothing left to judge on the run after the prerequisite lands.
  it('consumes the bump even while a prerequisite is claimed', () => {
    const host = makeHost({ awaitingPrerequisite: true })
    const run = drive(host)
    host.reload()
    noteFetchStarted(host)
    host.setAwaitingPrerequisite(false)
    expect(run('declined')).toBe(false)
  })

  // A fetch that started BEFORE the click cannot answer it. This is the ordinary
  // case of a retry landing on a display that is already loading, and the
  // per-region foundation's `deferred` outcome is what carries the bump across it.
  it('does not answer a bump that follows it', () => {
    const host = makeHost()
    const run = drive(host)
    noteFetchStarted(host)
    host.reload()
    expect(run('declined')).toBe(true)
  })

  // The flag half, which is what the per-region autorun classifies on: set by the
  // same call, and read once so a stale entry can't credit the next run.
  it('leaves a flag the foundation reads and clears', () => {
    const host = makeHost()
    drive(host)
    expect(takeFetchStarted(host)).toBe(false)
    noteFetchStarted(host)
    expect(takeFetchStarted(host)).toBe(true)
    expect(takeFetchStarted(host)).toBe(false)
  })

  it('is a no-op in production', () => {
    const prev = process.env.NODE_ENV
    const host = makeHost()
    const run = drive(host)
    process.env.NODE_ENV = 'production'
    try {
      noteFetchStarted(host)
    } finally {
      process.env.NODE_ENV = prev
    }
    expect(takeFetchStarted(host)).toBe(false)
    host.reload()
    expect(run('declined')).toBe(true)
  })
})

describe('deferred is the same hold, reached from inside the foundation', () => {
  it('holds the report', () => {
    const host = makeHost()
    const run = drive(host)
    host.reload()
    expect(run('deferred')).toBe(false)
  })

  it('leaves the bump outstanding for the run that follows', () => {
    const host = makeHost()
    const run = drive(host)
    host.reload()
    run('deferred')
    expect(run('declined')).toBe(true)
  })

  // It defers ahead of every other term, `loadingSuppressed` included — the run
  // did not reach the display's gate at all, so nothing about it is a verdict.
  it('does not consult loadingSuppressed', () => {
    const host = makeHost({ loadingSuppressed: true })
    const run = drive(host)
    host.reload()
    run('deferred')
    host.setLoadingSuppressed(false)
    expect(run('declined')).toBe(true)
  })

  it('survives any number of runs', () => {
    const host = makeHost()
    const run = drive(host)
    host.reload()
    for (let i = 0; i < 20; i++) {
      expect(run('deferred')).toBe(false)
    }
    expect(run('declined')).toBe(true)
  })
})

// Most displays never override the hook and take `FetchMixin`'s `false` — arc
// and LD on one foundation, eight of the ten on the other. Nothing about the
// ledger may depend on the override existing.
describe('with the hook left at its default', () => {
  it('reports a decline behind a bump', () => {
    const host = makeHost()
    const run = drive(host)
    host.reload()
    expect(run('declined')).toBe(true)
  })

  it('still honours the foundation-level deferral', () => {
    const host = makeHost()
    const run = drive(host)
    host.reload()
    expect(run('deferred')).toBe(false)
    expect(run('declined')).toBe(true)
  })
})

// The ledger starts from whatever the counter already is, so a display attached
// mid-session (or one whose reload fired before the autorun installed) does not
// read as a retry on its first run.
it('takes its baseline from the counter at install', () => {
  const host = makeHost()
  host.reload()
  host.reload()
  const run = drive(host)
  expect(run('declined')).toBe(false)
  host.reload()
  expect(run('declined')).toBe(true)
})

it('is a no-op in production', () => {
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    const host = makeHost()
    const run = drive(host)
    host.reload()
    expect(run('declined')).toBe(false)
  } finally {
    process.env.NODE_ENV = prev
  }
})
