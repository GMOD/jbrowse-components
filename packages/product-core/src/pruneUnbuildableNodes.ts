import { isModelType, isType } from '@jbrowse/mobx-state-tree'

import { asArray, isRecord } from './snapshotUtils.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

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
 * drawer — which jbrowse-web does not have (see `scripts/check-core-plugin-sets.ts`
 * for the exact relation between the products' lists). And a runtime plugin that
 * fails to load is already tolerated: `notifyPluginLoadFailures` says the session
 * opens without it, which was untrue for any session actually using its types.
 *
 * So the type is dropped and the session opens. `dropped` is what the caller
 * tells the user, which is the only part of this a person can act on.
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

// The type names a `pluggableMstType` union will actually accept. Mirrors that
// function's own filter — a registered type whose `stateModel` is not a model
// type is left out of the union, so a snapshot naming it fails the same way one
// naming nothing at all does.
function buildableTypes(pluginManager: PluginManager, group: PrunedGroup) {
  return new Set(
    pluginManager.getElementTypesInGroup(group).flatMap(t => {
      const { stateModel } = t as unknown as { stateModel?: unknown }
      return isType(stateModel) && isModelType(stateModel) ? [t.name] : []
    }),
  )
}

type Registry = Record<PrunedGroup, Set<string>>

function buildable(node: unknown, group: PrunedGroup, registry: Registry) {
  return isRecord(node) && typeof node.type === 'string'
    ? registry[group].has(node.type)
    : // a node with no readable type is not this function's problem: MST
      // reports it precisely, and guessing at a repair would hide it
      true
}

function describe(node: unknown, group: PrunedGroup): UnbuildableNode {
  const type = isRecord(node) ? node.type : undefined
  return { group, type: typeof type === 'string' ? type : 'unknown' }
}

function pruneList(
  list: unknown[],
  group: PrunedGroup,
  registry: Registry,
  dropped: UnbuildableNode[],
  prune?: (
    node: Record<string, unknown>,
  ) => Record<string, unknown> | undefined,
) {
  return list.flatMap(node => {
    if (!buildable(node, group, registry)) {
      dropped.push(describe(node, group))
      return []
    }
    const pruned = prune && isRecord(node) ? prune(node) : node
    return pruned === undefined ? [] : [pruned]
  })
}

// A view's own tracks, and the child views of a composite view (breakpoint-split,
// the linear-comparative family), which hold tracks of their own.
function pruneView(
  view: Record<string, unknown>,
  registry: Registry,
  dropped: UnbuildableNode[],
): Record<string, unknown> {
  const out = { ...view }
  if (Array.isArray(view.tracks)) {
    out.tracks = pruneList(view.tracks, 'track', registry, dropped, track =>
      pruneTrack(track, registry, dropped),
    )
  }
  if (Array.isArray(view.views)) {
    out.views = pruneList(view.views, 'view', registry, dropped, child =>
      pruneView(child, registry, dropped),
    )
  }
  return out
}

// A display type can go missing while its track type stays — a plugin
// contributing one more display to an existing track type is the ordinary case.
// A track left with none of them is dropped instead: it has nothing to render,
// and code downstream reads `displays[0]`.
function pruneTrack(
  track: Record<string, unknown>,
  registry: Registry,
  dropped: UnbuildableNode[],
): Record<string, unknown> | undefined {
  if (!Array.isArray(track.displays)) {
    return track
  }
  const displays = pruneList(track.displays, 'display', registry, dropped)
  if (displays.length === 0 && track.displays.length > 0) {
    dropped.push({ ...describe(track, 'track'), cascade: true })
    return undefined
  }
  return { ...track, displays }
}

function pruneWidgets(
  snapshot: Record<string, unknown>,
  registry: Registry,
  dropped: UnbuildableNode[],
) {
  if (!isRecord(snapshot.widgets)) {
    return {}
  }
  const widgets = Object.fromEntries(
    Object.entries(snapshot.widgets).filter(([, widget]) => {
      if (buildable(widget, 'widget', registry)) {
        return true
      }
      dropped.push(describe(widget, 'widget'))
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
  const registry: Registry = {
    widget: buildableTypes(pluginManager, 'widget'),
    view: buildableTypes(pluginManager, 'view'),
    track: buildableTypes(pluginManager, 'track'),
    display: buildableTypes(pluginManager, 'display'),
  }
  const dropped: UnbuildableNode[] = []
  const pruned = {
    ...snapshot,
    ...pruneWidgets(snapshot, registry, dropped),
    ...(Array.isArray(snapshot.views)
      ? {
          views: pruneList(
            asArray(snapshot.views),
            'view',
            registry,
            dropped,
            view => pruneView(view, registry, dropped),
          ),
        }
      : {}),
  }
  return dropped.length > 0
    ? { snapshot: pruned, dropped }
    : { snapshot, dropped }
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
