import { isModelType, isType } from '@jbrowse/mobx-state-tree'

import { isRecord } from './snapshotUtils.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

/**
 * A session snapshot that arrives from somewhere else — a share link, a desktop
 * "export to web" URL, a session.json — can name a pluggable type this build has
 * no plugin for. Every such collection is `types.map`/`types.array` over a bare
 * `pluggableMstType` union with no dispatcher, so one entry the union cannot
 * match throws `No type is applicable for the union` out of the `cast` in
 * `setSession` — outside the try that `filterSessionInPlace` sits in. The whole
 * session is lost, and jbrowse-web's fallback then advises the recipient to ask
 * for a link made with the Share button, which is often exactly what they were
 * sent.
 *
 * Two routes reach it and neither is exotic. A desktop export carries session
 * state built from desktop's own core plugins — `blat` registers
 * `UcscResultsWidget`, and every BLAT or in-silico PCR search leaves one in the
 * drawer — which jbrowse-web does not have (see
 * `scripts/check-core-plugin-sets.ts` for the exact relation between the
 * products' lists). And a runtime plugin that fails to load is already
 * tolerated: `notifyPluginLoadFailures` says the session opens without it, which
 * was untrue for any session actually using its types.
 *
 * So the type is dropped and the session opens. `dropped` is what the caller
 * tells the user, which is the only part of this a person can act on.
 *
 * **A node is dropped only when both tests fail**: its `type` names no
 * registered element, AND the real MST union refuses the snapshot. The second
 * test is what keeps a renamed type alive — a DisplayType can declare `aliases`,
 * and a model's own `preProcessSnapshot` can rewrite the type literal
 * (`LinearMultiSampleVariantDisplay` does both for the old
 * `MultiLinearVariantDisplay`), neither of which the registry's names show. The
 * first test is what keeps this from quietly swallowing a *malformed* snapshot
 * of a type this build does have: that still throws, exactly as before, because
 * a silent drop there would hide a real bug behind a message about plugins.
 */

type PrunedGroup = 'widget' | 'view' | 'track' | 'display'

export interface UnbuildableNode {
  group: PrunedGroup
  type: string
  // dropped for what it contained rather than for its own type — a track whose
  // every display went. Its type is not a missing plugin, so the message must
  // not name it as one.
  cascade?: true
}

// The type names a `pluggableMstType` union will accept outright. Mirrors that
// function's own filter: a registered type whose `stateModel` is not a model
// type is left out of the union, so a snapshot naming it fails the same way one
// naming nothing at all does.
function registeredNames(pluginManager: PluginManager, group: PrunedGroup) {
  return new Set(
    pluginManager.getElementTypesInGroup(group).flatMap(t => {
      const { stateModel } = t as unknown as { stateModel?: unknown }
      return isType(stateModel) && isModelType(stateModel) ? [t.name] : []
    }),
  )
}

// One prune's view of the plugin manager. The unions are built on first use, so
// a session naming only registered types — every session this build produced
// itself — never constructs one.
class Registry {
  private names = new Map<PrunedGroup, Set<string>>()
  private unions = new Map<PrunedGroup, IAnyType>()

  constructor(private pluginManager: PluginManager) {}

  keeps(node: unknown, group: PrunedGroup) {
    const type = isRecord(node) ? node.type : undefined
    if (typeof type !== 'string') {
      // MST reports a node with no readable type precisely; guessing at a
      // repair here would hide it
      return true
    }
    let names = this.names.get(group)
    if (!names) {
      names = registeredNames(this.pluginManager, group)
      this.names.set(group, names)
    }
    return names.has(type) || this.union(group).is(node)
  }

  private union(group: PrunedGroup) {
    let union = this.unions.get(group)
    if (!union) {
      union = this.pluginManager.pluggableMstType(group, 'stateModel')
      this.unions.set(group, union)
    }
    return union
  }
}

function describe(node: unknown, group: PrunedGroup): UnbuildableNode {
  const type = isRecord(node) ? node.type : undefined
  return { group, type: typeof type === 'string' ? type : 'unknown' }
}

interface Prune {
  registry: Registry
  dropped: UnbuildableNode[]
}

// Children first, then the node itself: the union's `is` validates a whole
// subtree, so a view still holding an unbuildable track would be refused as a
// whole and taken down with it.
function pruneList(
  list: unknown[],
  group: PrunedGroup,
  prune: Prune,
  pruneChild?: (
    node: Record<string, unknown>,
  ) => Record<string, unknown> | undefined,
) {
  return list.flatMap(node => {
    const pruned = pruneChild && isRecord(node) ? pruneChild(node) : node
    if (pruned === undefined) {
      // pruneChild dropped it and recorded why
      return []
    }
    if (prune.registry.keeps(pruned, group)) {
      return [pruned]
    }
    prune.dropped.push(describe(node, group))
    return []
  })
}

// A view's own tracks, and the child views of a composite view (breakpoint-split,
// the linear-comparative family), which hold tracks of their own.
function pruneView(view: Record<string, unknown>, prune: Prune) {
  const out = { ...view }
  if (Array.isArray(view.tracks)) {
    out.tracks = pruneList(view.tracks, 'track', prune, track =>
      pruneTrack(track, prune),
    )
  }
  if (Array.isArray(view.views)) {
    out.views = pruneList(view.views, 'view', prune, child =>
      pruneView(child, prune),
    )
  }
  return out
}

// A display type can go missing while its track type stays — a plugin
// contributing one more display to an existing track type is the ordinary case.
// A track left with none of them goes too: an empty `displays` array is valid
// MST, so nothing downstream would refuse it, and `activeDisplay` reads
// `displays[0]` on the promise that a shown track always has one.
function pruneTrack(track: Record<string, unknown>, prune: Prune) {
  if (!Array.isArray(track.displays)) {
    return track
  }
  const displays = pruneList(track.displays, 'display', prune)
  if (displays.length === 0 && track.displays.length > 0) {
    prune.dropped.push({ ...describe(track, 'track'), cascade: true })
    return undefined
  }
  return { ...track, displays }
}

function pruneWidgets(snapshot: Record<string, unknown>, prune: Prune) {
  if (!isRecord(snapshot.widgets)) {
    return {}
  }
  const widgets = Object.fromEntries(
    Object.entries(snapshot.widgets).filter(([, widget]) => {
      if (prune.registry.keeps(widget, 'widget')) {
        return true
      }
      prune.dropped.push(describe(widget, 'widget'))
      return false
    }),
  )
  // `activeWidgets` holds safeReferences, which do drop themselves when their
  // target is gone, but only once something resolves them — dropping them here
  // keeps the pruned snapshot internally consistent rather than relying on that.
  const activeWidgets = isRecord(snapshot.activeWidgets)
    ? Object.fromEntries(
        Object.entries(snapshot.activeWidgets).filter(
          ([, id]) => typeof id !== 'string' || id in widgets,
        ),
      )
    : undefined
  return { widgets, ...(activeWidgets ? { activeWidgets } : {}) }
}

/**
 * Drops the session-snapshot nodes whose pluggable type this plugin manager
 * cannot build, returning the snapshot unchanged (by identity) when there are
 * none — which is every session this build produced itself.
 */
export function pruneUnbuildableNodes(
  snapshot: Record<string, unknown>,
  pluginManager: PluginManager,
): { snapshot: Record<string, unknown>; dropped: UnbuildableNode[] } {
  const prune: Prune = { registry: new Registry(pluginManager), dropped: [] }
  const pruned = {
    ...snapshot,
    ...pruneWidgets(snapshot, prune),
    ...(Array.isArray(snapshot.views)
      ? {
          views: pruneList(snapshot.views, 'view', prune, view =>
            pruneView(view, prune),
          ),
        }
      : {}),
  }
  return prune.dropped.length > 0
    ? { snapshot: pruned, dropped: prune.dropped }
    : { snapshot, dropped: prune.dropped }
}

/**
 * The user-facing summary of one prune, or undefined when nothing was dropped.
 * Names the missing types rather than counting nodes: the plugin a person has to
 * install is the actionable half, and one missing display type can take several
 * nodes with it.
 */
export function describeUnbuildableNodes(dropped: UnbuildableNode[]) {
  const types = [
    ...new Set(dropped.flatMap(d => (d.cascade ? [] : [d.type]))),
  ].join(', ')
  return types
    ? `Removed session items that need plugins this JBrowse does not have: ${types}`
    : undefined
}
