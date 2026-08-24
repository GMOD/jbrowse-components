import { leadingEdgeAutorun } from '@jbrowse/core/util/leadingEdgeAutorun'
import { getContainingView } from '@jbrowse/core/util/mstUtils'
import { namedAutorun } from '@jbrowse/render-core/namedReactions'

import type { RegionHost } from './regionHost.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

// This ESM package builds without @types/node, but consuming bundlers
// (webpack/vite) still string-replace `process.env.NODE_ENV`, so keep the
// reference and give it a minimal module-scoped type for tsc.
declare const process: { env: { NODE_ENV?: string } }

/**
 * Install an autorun on a display whose body only runs once the containing LGV
 * is initialized (measured width + ready assemblies). Centralizes the
 * `if (!view.initialized) return` guard every LGV-display autorun needs: before
 * init, view-derived getters like `view.width` throw by design, so a body that
 * reads them must not run yet. `initialized` is observable, so the body re-runs
 * automatically the moment the view becomes ready. The view is passed in so
 * callers don't re-fetch it.
 *
 * **`delay` is leading-edge**, not MobX's trailing-edge `{ delay }`: the first
 * run is one microtask away rather than a full delay, and the debounce arms only
 * once the body returns `true`. A pre-init run therefore costs nothing, which is
 * also why the not-initialized branch cannot report work. See
 * {@link leadingEdgeAutorun}.
 */
export function autorunOnReadyView(
  self: IAnyStateTreeNode,
  fn: (view: RegionHost) => boolean | void,
  { name, delay }: { name: string; delay?: number },
) {
  const body = () => {
    const view = getContainingView(self) as RegionHost
    return view.initialized ? fn(view) : false
  }
  if (delay === undefined) {
    namedAutorun(self, body, { name })
  } else {
    leadingEdgeAutorun(self, body, { name, delay })
  }
}

/**
 * Run `clear` whenever the containing view's `displayedRegions` reference
 * changes (chromosome navigation, region reorder, etc). Use for state keyed by
 * `displayedRegionIndex` that intentionally survives `clearAllRpcData` —
 * chromosome navigation reuses indices, so an entry left over from chr1 would
 * silently apply to chr2 (canvas's `densityStatsPerRegion` is the canonical
 * case). Plugins whose entire per-region data clears through
 * `clearDisplaySpecificData` don't need this — the per-region family's own
 * `DisplayedRegionsChange` autorun already covers them.
 */
export function onDisplayedRegionsChange(
  self: IAnyStateTreeNode,
  clear: () => void,
  name = 'OnDisplayedRegionsChange',
) {
  autorunOnReadyView(
    self,
    view => {
      void view.displayedRegions
      clear()
    },
    { name },
  )
}

/**
 * Dev-only feedback-loop guard for the (undelayed) `SettingsInvalidate` autorun.
 * The classic `rpcProps()` trap (ARCHITECTURE.md §"rpcProps() loop trap") puts a
 * fetch-derived value in `rpcProps()`, so the autorun that reads it and clears
 * fetched data re-invalidates itself — MobX runs it until its 100-iteration
 * convergence guard throws a cryptic "Reaction doesn't converge". Call this at
 * the top of the body's mutating section: it throws a message naming the actual
 * cause the first time the body re-fires far more times in one synchronous tick
 * than any real settings change could, and — because it throws *before* the
 * `clearAllRpcData()` that perpetuates the cycle — that iteration's invalidating
 * mutation never runs, breaking the loop. No-op in production. (The debounced
 * `installGlobalFetchAutorun` variant loops on the async-fetch cadence, not
 * synchronously, so this within-tick counter does not catch it — that hazard is
 * documented at the call site instead.)
 */
export function makeSettingsLoopGuard(name: string): () => void {
  if (process.env.NODE_ENV === 'production') {
    return () => {}
  }
  let firesThisTick = 0
  let resetScheduled = false
  return () => {
    firesThisTick += 1
    if (!resetScheduled) {
      resetScheduled = true
      // Runs once the synchronous tick unwinds; a runaway loop never yields to
      // it, so the counter keeps climbing until the throw below.
      queueMicrotask(() => {
        firesThisTick = 0
        resetScheduled = false
      })
    }
    if (firesThisTick > 50) {
      throw new Error(
        `${name} re-fired >50× in one synchronous tick — a fetch-derived value ` +
          `is almost certainly in rpcProps(), so invalidating the fetch changes ` +
          `rpcProps() and re-invalidates it. See ARCHITECTURE.md "rpcProps() ` +
          `loop trap": rpcProps() must read only user-controlled settings.`,
      )
    }
  }
}
