import { getSession } from '@jbrowse/core/util'
import { hasParent } from '@jbrowse/mobx-state-tree'

import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

interface ComparativeViewSelf extends IStateTreeNode {
  assemblyNames: string[]
}

/**
 * Give back the temporary assemblies a comparative view brought into the
 * session — the read-vs-ref pair a dotplot or a synteny view synthesizes, which
 * nothing else owns and nothing else would remove.
 *
 * **This reaches outside the view's own tree, which is what makes WHEN it runs
 * a real question.** `session.removeView` detaches a view rather than
 * destroying it in place (ADR-069), so on the task that finally destroys it the
 * view is a root and `getSession` has no session to walk to — it throws
 * `no session model found!` out of `beforeDestroy`, from inside MST's teardown.
 *
 * So a comparative view calls this from `beforeDetach`, which `removeView`
 * invokes while the view is still attached, and `beforeDestroy` keeps calling
 * it too for the paths that destroy a view without taking it out of a session
 * first. `hasParent` is the discriminator between the two, and the second call
 * is a no-op either way: `removeTemporaryAssembly` looks a name up before
 * removing it, and half of every one of these lists is a permanent assembly it
 * never held.
 *
 * The track configs such a view synthesizes need nothing here — they ride on the
 * track that draws them (`showTrackGeneric`'s `inlineConf`) rather than in a
 * session list, so they go out with the view itself.
 */
export function releaseTemporaryAssemblies(self: ComparativeViewSelf) {
  if (!hasParent(self)) {
    return
  }
  const session = getSession(self)
  for (const name of self.assemblyNames) {
    session.removeTemporaryAssembly?.(name)
  }
}
