import { getMembers } from '@jbrowse/mobx-state-tree'

import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

// This ESM package builds without @types/node, but consuming bundlers
// (webpack/vite) still string-replace `process.env.NODE_ENV`, so keep the
// reference and give it a minimal module-scoped type for tsc.
declare const process: { env: { NODE_ENV?: string } }

// Nodes whose fetch foundation has already installed its autoruns. A display
// that (wrongly) chains to super in its own `afterAttach` re-enters the mixin's
// hook on the same node, which is the only way to land here twice.
const attached = new WeakSet<object>()

// Hooks that MUST be `.views()`. MobX runs an action inside `untracked`, so
// declaring either in `.actions()` makes its reads register no dependency and
// the caller silently keeps a stale answer. It has regressed twice, because
// each caller independently reads something that moves in lockstep.
const MUST_BE_VIEWS = ['isCacheValid', 'rpcProps'] as const

function report(message: string) {
  // `console.error`, never `throw`: an error escaping `afterAttach` is read by
  // the session loader as an invalid track and the display is silently dropped
  // — which would hide the very contract violation this is reporting.
  console.error(`[jbrowse display contract] ${message}`)
}

/**
 * Dev-only check of the display contracts that no type expresses and whose
 * violation is silent. Called once from the per-region fetch foundation's
 * `afterAttach`; no-op in production.
 *
 * ARCHITECTURAL_LIMITS.md §"Ordering is the contract, in four places" asks for
 * exactly this — "each order becomes explicit data … `makeSettingsLoopGuard` is
 * this move already applied to the `rpcProps` loop trap. Generalize it." Two of
 * the four are checkable here without any chance of a false positive; the third
 * (a gate mixin landing on the wrong side of `.compose()`) is checked by that
 * mixin itself, where it is local, and the fourth (a trigger read under a gate)
 * is a shape, not a state, so it stays a test.
 *
 * Every message names the fix, not just the symptom — the failure modes here
 * cost hours precisely because the symptom (a wedged display, a stale cache)
 * points nowhere near the cause.
 */
export function assertDisplayContract(self: IAnyStateTreeNode) {
  if (process.env.NODE_ENV === 'production') {
    return
  }
  if (attached.has(self)) {
    report(
      `${getMembers(self).name}: the fetch foundation's afterAttach ran twice on ` +
        `one display, so all five fetch autoruns are installed twice (double ` +
        `fetches, double clears). Our MST fork auto-chains lifecycle hooks — ` +
        `delete the superAfterAttach() call from this display's afterAttach. ` +
        `See BaseLinearDisplay/CLAUDE.md, "Lifecycle traps".`,
    )
    return
  }
  attached.add(self)

  const { actions, name } = getMembers(self)
  for (const hook of MUST_BE_VIEWS) {
    if (actions.includes(hook)) {
      report(
        `${name}: \`${hook}\` is declared in .actions(), which must be .views(). ` +
          `MobX runs actions untracked, so its reads register no dependency and ` +
          `callers keep a stale answer — silently. Move it to a .views() block.`,
      )
    }
  }
}
