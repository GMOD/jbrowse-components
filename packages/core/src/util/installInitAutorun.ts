import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { getNotificationSink } from './sessionServices.ts'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

interface InitAutorunHost<T> extends IStateTreeNode {
  init?: T
  setInit: (init?: T) => void
  setError: (error: unknown) => void
}

export interface InitApplyContext {
  /**
   * True once this init can no longer be the one being applied: the node is
   * gone, or a newer `setInit` has replaced it. Any mid-apply wait that can
   * park indefinitely must fold this into its condition — an unbounded wait on
   * state that never arrives holds the drain open, and the newer init that
   * would have superseded it is exactly what gets stranded. This is the causal
   * form of the wait ceiling; a fixed timeout bounds the same hazard only by
   * guessing, and pays for it by expiring on slow-but-healthy loads.
   */
  superseded: () => boolean
}

interface InitAutorunOptions<T> {
  /** autorun name, for the MobX devtools/spy stream */
  name: string
  /**
   * Read synchronously at the top of the autorun, so whatever it touches is
   * the dependency set that re-fires this. Typically the measured width plus
   * whatever the view needs before `apply` can run.
   */
  ready: () => boolean
  /**
   * Whether the view has materialized — the same line each view's
   * postProcessSnapshot draws for persistence (dotplot: assemblyNames set;
   * synteny: rows built). Decides the failure policy, see below.
   */
  materialized: () => boolean
  /** Apply one init blob. Owns the ordered steps; never clears `init`. */
  apply: (init: T, ctx: InitApplyContext) => Promise<void>
}

// Clear only when `init` is still the exact object we applied. A setInit that
// lands while `apply` is awaiting (React StrictMode remounts, a programmatic
// re-launch) swaps in a new object; clearing unconditionally would silently
// drop that pending init. Leaving it lets the drain loop apply it next.
function clearIfUnchanged<T>(self: InitAutorunHost<T>, init: T) {
  if (isAlive(self) && self.init === init) {
    self.setInit(undefined)
  }
}

async function applyInitOnce<T>(
  self: InitAutorunHost<T>,
  init: T,
  { apply, materialized }: InitAutorunOptions<T>,
) {
  try {
    await apply(init, {
      superseded: () => !isAlive(self) || self.init !== init,
    })
    clearIfUnchanged(self, init)
  } catch (e) {
    // the autorun body is async, so anything escaping here becomes an
    // unhandled rejection: no report at all, and the drain stops with the view
    // half-initialized
    console.error(e)
    if (isAlive(self)) {
      if (materialized()) {
        clearIfUnchanged(self, init)
        getNotificationSink(self).notifyError(`${e}`, e)
      } else {
        self.setError(e)
      }
    }
  }
}

function currentInit<T>(
  self: InitAutorunHost<T>,
  { ready }: InitAutorunOptions<T>,
) {
  return isAlive(self) && ready() ? self.init : undefined
}

// Apply pending inits one at a time until none remain. Serializing (rather
// than letting the autorun run `apply` concurrently) is what keeps re-entrant
// width churn safe: overlapping applies duplicate whatever the init appends
// (LGV's highlights did exactly this) and, where `apply` rebuilds sub-views,
// the second run detaches the models the first is still awaiting. Looping also
// guarantees an init set mid-apply is eventually applied instead of stranded.
async function drainInit<T>(
  self: InitAutorunHost<T>,
  opts: InitAutorunOptions<T>,
) {
  let pending = currentInit(self, opts)
  while (pending !== undefined) {
    await applyInitOnce(self, pending, opts)
    const next = currentInit(self, opts)
    // a fatal failure keeps `init` for a reload retry; the same object still
    // sitting there means it was not consumed, so stop rather than spin on it
    pending = next === pending ? undefined : next
  }
}

/**
 * The init state machine shared by the views that take a declarative `init`
 * blob (LinearGenomeView, DotplotView, LinearSyntenyView): the re-entry guard,
 * the readiness gate, the serialized drain, the identity-checked clear, the
 * isAlive guards, and one failure policy.
 *
 * The failure policy keys off `materialized`, the same line each view's
 * postProcessSnapshot already draws for persistence:
 *
 * - Not materialized — nothing is on screen and `init` is still persisted, so
 *   keep it for a reload retry and `setError`. That flips the view onto its
 *   import form, which renders the error in its own banner; a snackbar would
 *   state the same failure twice and the banner is the one that persists.
 * - Materialized — the view works, so a later failure is one sub-step's
 *   problem and must not take the view down with it. `setError` would, since
 *   showImportForm keys off `error` alone and would discard rows that loaded
 *   fine, so report it as a snackbar instead. Clearing `init` is also what
 *   disarms the re-fire: `ready` usually folds in the measured width, so
 *   leaving it set lets any resize re-run `apply` over a half-applied init.
 *
 * `apply` therefore never clears `init` and never catches for reporting — it
 * catches only the failures it wants to keep going through (a bad locstring in
 * one row), and everything it lets escape is fatal-as-of-that-point.
 */
export function installInitAutorun<T>(
  self: InitAutorunHost<T>,
  opts: InitAutorunOptions<T>,
) {
  // `draining` is a plain closure flag, intentionally NOT observable so it
  // stays out of the dependency graph. The autorun observes init + whatever
  // `ready` reads, so it re-fires when either changes, but a re-entrant pass
  // while a drain is in flight is a no-op — drainInit already consumes
  // whatever init is current. The flag is load-bearing, not incidental:
  // `ready` flips true→false→true when the measured width resets (StrictMode
  // remount, a workspace tab being shown again), which re-fires this whether it
  // is an autorun or a reaction.
  let draining = false
  addDisposer(
    self,
    autorun(
      async function initAutorun() {
        // read both unconditionally: they are the dependency set, and a run
        // that bails still has to be woken by the thing it bailed on. Teardown
        // mutates observables `ready` reads before the disposers run, and
        // reading a detached node throws — here into an unawaited promise.
        const alive = isAlive(self)
        const isReady = alive && opts.ready()
        const init = alive ? self.init : undefined
        if (isReady && init !== undefined && !draining) {
          draining = true
          try {
            await drainInit(self, opts)
          } finally {
            draining = false
          }
        }
      },
      { name: opts.name },
    ),
  )
}
