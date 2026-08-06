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
 * violation is silent. No-op in production.
 *
 * Called once per display from **whichever fetch foundation installed its
 * autoruns** — `MultiRegionDisplayMixin`'s `afterAttach` for the per-region
 * family, `installGlobalFetchAutorun` for the global one. It was per-region
 * only until 2026-08, which left the family with *fewer* safety nets
 * unchecked: HiC and LD both define `rpcProps()`, `installGlobalFetchAutorun`
 * serializes it into the autorun's trigger list, and an `rpcProps` declared in
 * `.actions()` there fails exactly the same way — reads register no
 * dependency, so a settings change stops invalidating — with no
 * `makeSettingsLoopGuard` on that side to catch anything either.
 *
 * `installedBy` names the caller so the double-install message can describe the
 * right thing; the WeakSet is shared, which is correct — a display composes one
 * fetch foundation, so reaching here twice is the bug regardless of which.
 *
 * ARCHITECTURAL_LIMITS.md §"Ordering is the contract" asks for exactly this —
 * "each order becomes explicit data … `makeSettingsLoopGuard` is this move
 * already applied to the `rpcProps` loop trap. Generalize it." That doc's "Now
 * checked" list is the authoritative account of which contracts report
 * themselves and which are still silent; don't restate the split here, because
 * this comment said "four places" against a heading that said five and a list
 * that held six.
 *
 * Every message names the fix, not just the symptom — the failure modes here
 * cost hours precisely because the symptom (a wedged display, a stale cache)
 * points nowhere near the cause.
 */
export function assertDisplayContract(
  self: IAnyStateTreeNode,
  installedBy = "the per-region fetch foundation's afterAttach",
) {
  if (process.env.NODE_ENV === 'production') {
    return
  }
  if (attached.has(self)) {
    report(
      `${getMembers(self).name}: ${installedBy} ran twice on one display, so ` +
        `its fetch autoruns are installed twice (double fetches, double ` +
        `clears). Our MST fork auto-chains lifecycle hooks — delete the ` +
        `superAfterAttach() call from this display's afterAttach. ` +
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
