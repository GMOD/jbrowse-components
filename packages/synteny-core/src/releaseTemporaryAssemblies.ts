import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { hasParent } from '@jbrowse/mobx-state-tree'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

interface ComparativeViewSelf extends IStateTreeNode {
  assemblyNames: string[]
}

// The two session lists this reads, both optional: `AbstractSessionModel`
// declares neither, and an embedded session may have neither.
interface SessionAssemblyOwner {
  temporaryAssemblies?: AnyConfigurationModel[]
  sessionTracks?: AnyConfigurationModel[]
  removeTemporaryAssembly?: (name: string) => void
  deleteTrackConf?: (conf: AnyConfigurationModel) => void
}

/**
 * Give back the temporary assemblies a comparative view brought into the
 * session — the read-vs-ref pair a dotplot or a synteny view synthesizes, which
 * nothing else owns and nothing else would remove — and with them the session
 * tracks that only those assemblies could ever draw.
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
 * is a no-op either way: nothing below acts on a name the session no longer
 * holds as temporary.
 */
export function releaseTemporaryAssemblies(self: ComparativeViewSelf) {
  if (!hasParent(self)) {
    return
  }
  const session = getSession(self) as unknown as SessionAssemblyOwner
  // The view's OWN names intersected with what the session actually holds as
  // temporary, which is a narrower thing than `self.assemblyNames` and has to
  // be: a read-vs-ref pair is [the real reference, the synthetic read], so half
  // of every one of these lists is a permanent assembly the session shares with
  // every other view. `removeTemporaryAssembly` looks a name up and so was
  // already immune, but the track sweep below is not — over the raw list it
  // would delete the user's own hg38 session tracks on closing a synteny view.
  const temporary = new Set(
    (session.temporaryAssemblies ?? []).map(
      conf => readConfObject(conf, 'name') as string,
    ),
  )
  const released = self.assemblyNames.filter(name => temporary.has(name))
  if (released.length === 0) {
    return
  }
  const releasedSet = new Set(released)
  // Tracks first, while the assemblies they name still resolve.
  //
  // A session track every one of whose assemblies is being released cannot be
  // drawn by anything, ever again, so leaving it is not conservatism — it is a
  // dead config accumulating one per launch in the snapshot the user saves and
  // shares. "Reconstruct derivative allele" is what showed this: its segment
  // labels are a `FromConfigAdapter` track over the synthetic derivative axis,
  // so closing the view took the axis and left the track naming an assembly
  // that no longer existed.
  //
  // Here rather than in that launcher because it is the same ownership this
  // function already keeps: a track whose only assembly came in with a view
  // goes out with it, whichever launcher put it there.
  //
  // Over a copy, since `deleteTrackConf` splices the list being walked. And
  // `length > 0`, because `every` is true of nothing and a track config naming
  // no assembly at all is not this view's to delete.
  for (const conf of [...(session.sessionTracks ?? [])]) {
    const names = readConfObject(conf, 'assemblyNames') as string[] | undefined
    if (names?.length && names.every(name => releasedSet.has(name))) {
      session.deleteTrackConf?.(conf)
    }
  }
  for (const name of released) {
    session.removeTemporaryAssembly?.(name)
  }
}
