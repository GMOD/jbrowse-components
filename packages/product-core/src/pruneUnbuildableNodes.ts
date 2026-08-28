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
 * So the node comes out of the tree and the session opens. `dropped` is what the
 * caller tells the user, which is the only part of this a person can act on.
 *
 * **The node is held, not discarded.** Taking it out of the tree is only half
 * the job: jbrowse-web autosaves `getSnapshot(session)` on a 400ms debounce
 * (`rootModel/persistence.ts`), so a recipient who merely opens a shared link
 * without the plugin writes the reduced session back over the stored row — and
 * reshares it that way. The removed nodes ride along under
 * `heldForMissingPlugins` instead, and a build that has the plugin puts them
 * back. Installing the plugin and reloading is then enough to get the session
 * whole again, which is what makes a plugin removable at all.
 *
 * **A node is held only when all three tests fail** (`Registry.admit`): its
 * `type` names no registered element, no element declares it as an `alias`, and
 * the real MST union refuses the snapshot. The last two are what keep a renamed
 * type alive — an element can declare `aliases`, and a model's own
 * `preProcessSnapshot` can rewrite the type literal
 * (`LinearMultiSampleVariantDisplay` does both for the old
 * `MultiLinearVariantDisplay`), neither of which the registry's names show. The
 * first is what keeps this from quietly swallowing a *malformed* snapshot of a
 * type this build does have: that still throws, exactly as before, because
 * holding it would hide a real bug behind a message about plugins.
 */

type PrunedGroup = 'widget' | 'view' | 'track' | 'display'

/** The reserved session-snapshot key the held nodes travel under. */
export const HELD_NODES_KEY = 'heldForMissingPlugins'

export interface UnbuildableNode {
  group: PrunedGroup
  type: string
  // dropped for what it contained rather than for its own type — a track whose
  // every display went. Its type is not a missing plugin, so the message must
  // not name it as one.
  cascade?: true
}

/**
 * One node taken out of the tree, with the anchor that puts it back.
 *
 * The anchor is a parent **id** plus a position, never a path: paths are
 * index-based and every edit the recipient makes shifts them, while a view id
 * and a track id are stable for as long as the container exists. A held node
 * whose parent the recipient has since deleted is not restorable and is not
 * meant to be — the container going is the user saying so.
 */
export interface HeldNode {
  group: PrunedGroup
  /** map key, for a widget */
  key?: string
  /**
   * id of the containing view (a track, or the child view of a composite one)
   * or of the containing track (a display). Absent for a top-level view.
   */
  parent?: string
  /** position in the list it came out of, so a restore lands where it was */
  index: number
  snapshot: Record<string, unknown>
}

// The registered elements a `pluggableMstType` union is built from. Mirrors
// that function's own filter: a registered type whose `stateModel` is not a
// model type is left out of the union, so a snapshot naming it fails the same
// way one naming nothing at all does.
//
// Typed structurally rather than as `PluggableElementBase`, which is not a
// published `@jbrowse/core` subpath — adding one just to name a type here would
// widen the plugin ABI for nothing.
function buildableElements(pluginManager: PluginManager, group: PrunedGroup) {
  return pluginManager.getElementTypesInGroup(group).filter(t => {
    const { stateModel } = t as unknown as { stateModel?: unknown }
    return isType(stateModel) && isModelType(stateModel)
  }) as unknown as { name: string; aliases?: string[] }[]
}

// One prune's view of the plugin manager. The unions are built on first use, so
// a session naming only registered types — every session this build produced
// itself — never constructs one.
class Registry {
  private names = new Map<PrunedGroup, Set<string>>()
  private aliases = new Map<PrunedGroup, Map<string, string>>()
  private unions = new Map<PrunedGroup, IAnyType>()

  constructor(private pluginManager: PluginManager) {}

  /**
   * The node to keep — canonicalized if it names an element's alias — or
   * undefined if this build cannot hold it.
   *
   * A registered name is admitted without asking the union, so a **malformed**
   * snapshot of a type this build does have still reaches MST and throws there.
   * Holding it would hide a real bug behind a message about plugins.
   */
  admit(node: unknown, group: PrunedGroup): unknown {
    const type = isRecord(node) ? node.type : undefined
    if (typeof type !== 'string') {
      // MST reports a node with no readable type precisely; guessing at a
      // repair here would hide it
      return node
    }
    if (this.namesFor(group).has(type)) {
      return node
    }
    const canonical = this.aliasesFor(group).get(type)
    if (canonical !== undefined) {
      return { ...(node as Record<string, unknown>), type: canonical }
    }
    // a type the registry cannot name that the union takes anyway: an element's
    // own preProcessSnapshot rewriting the type literal
    return this.union(group).is(node) ? node : undefined
  }

  private namesFor(group: PrunedGroup) {
    let names = this.names.get(group)
    if (!names) {
      names = new Set(
        buildableElements(this.pluginManager, group).map(t => t.name),
      )
      this.names.set(group, names)
    }
    return names
  }

  private aliasesFor(group: PrunedGroup) {
    let aliases = this.aliases.get(group)
    if (!aliases) {
      aliases = new Map(
        buildableElements(this.pluginManager, group).flatMap(
          t => t.aliases?.map(alias => [alias, t.name] as const) ?? [],
        ),
      )
      this.aliases.set(group, aliases)
    }
    return aliases
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

function readId(node: unknown) {
  const id = isRecord(node) ? node.id : undefined
  return typeof id === 'string' ? id : undefined
}

function readHeld(snapshot: Record<string, unknown>): HeldNode[] {
  const held = snapshot[HELD_NODES_KEY]
  return Array.isArray(held) ? (held as HeldNode[]) : []
}

interface Prune {
  registry: Registry
  dropped: UnbuildableNode[]
  held: HeldNode[]
  // nodes `admit` canonicalized. Counted rather than inferred from object
  // identity, because pruneList/pruneView rebuild every node they walk — and a
  // session whose only change is a rename must not take the identity
  // short-circuit at the bottom, which would hand back the old names.
  renamed: number
}

// Children first, then the node itself: the union's `is` validates a whole
// subtree, so a view still holding an unbuildable track would be refused as a
// whole and taken down with it.
//
// A node that goes is held **whole and unpruned**, and the entries its own
// children produced are rolled back to `mark`. That is what keeps every held
// entry self-contained: a dropped view's tracks are inside the copy of the view,
// not separate entries anchored to a view that is no longer in the tree, so a
// restore never depends on the order the entries come back in.
function pruneList(
  list: unknown[],
  group: PrunedGroup,
  prune: Prune,
  parent?: string,
  pruneChild?: (
    node: Record<string, unknown>,
  ) => Record<string, unknown> | undefined,
) {
  return list.flatMap((node, index) => {
    const mark = prune.held.length
    const pruned = pruneChild && isRecord(node) ? pruneChild(node) : node
    const admitted =
      pruned === undefined ? undefined : prune.registry.admit(pruned, group)
    if (admitted !== undefined) {
      if (admitted !== pruned) {
        prune.renamed++
      }
      return [admitted]
    }
    prune.held.length = mark
    if (pruned !== undefined) {
      // pruneChild drops a node only after recording why
      prune.dropped.push(describe(node, group))
    }
    if (isRecord(node)) {
      prune.held.push({ group, parent, index, snapshot: node })
    }
    return []
  })
}

// A view's own tracks, and the child views of a composite view (breakpoint-split,
// the linear-comparative family), which hold tracks of their own.
function pruneView(view: Record<string, unknown>, prune: Prune) {
  const out = { ...view }
  const id = readId(view)
  if (Array.isArray(view.tracks)) {
    out.tracks = pruneList(view.tracks, 'track', prune, id, track =>
      pruneTrack(track, prune),
    )
  }
  if (Array.isArray(view.views)) {
    out.views = pruneList(view.views, 'view', prune, id, child =>
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
  const displays = pruneList(track.displays, 'display', prune, readId(track))
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
    Object.entries(snapshot.widgets).flatMap(([key, widget]) => {
      const admitted = prune.registry.admit(widget, 'widget')
      if (admitted !== undefined) {
        if (admitted !== widget) {
          prune.renamed++
        }
        return [[key, admitted] as const]
      }
      prune.dropped.push(describe(widget, 'widget'))
      if (isRecord(widget)) {
        prune.held.push({ group: 'widget', key, index: 0, snapshot: widget })
      }
      return []
    }),
  )
  // `activeWidgets` holds safeReferences, which do drop themselves when their
  // target is gone, but only once something resolves them — dropping them here
  // keeps the pruned snapshot internally consistent rather than relying on that.
  // Deliberately not held: a drawer panel that comes back closed costs a click,
  // where a widget that comes back missing costs the work in it.
  const activeWidgets = isRecord(snapshot.activeWidgets)
    ? Object.fromEntries(
        Object.entries(snapshot.activeWidgets).filter(
          ([, id]) => typeof id !== 'string' || id in widgets,
        ),
      )
    : undefined
  return { widgets, ...(activeWidgets ? { activeWidgets } : {}) }
}

// Mutable copies of every list a held node can go back into, indexed by the id
// its anchor names. Copying up front rather than splicing into the caller's
// snapshot keeps the no-op case returning the original object by identity.
class Anchors {
  readonly views = new Map<string, Record<string, unknown>>()
  readonly tracks = new Map<string, Record<string, unknown>>()

  constructor(readonly topViews: unknown[]) {
    for (const [i, view] of topViews.entries()) {
      if (isRecord(view)) {
        topViews[i] = this.copyView(view)
      }
    }
  }

  private copyView(view: Record<string, unknown>) {
    const out = { ...view }
    if (Array.isArray(view.tracks)) {
      out.tracks = view.tracks.map(t => (isRecord(t) ? this.copyTrack(t) : t))
    }
    if (Array.isArray(view.views)) {
      out.views = view.views.map(v => (isRecord(v) ? this.copyView(v) : v))
    }
    const id = readId(view)
    if (id !== undefined) {
      this.views.set(id, out)
    }
    return out
  }

  private copyTrack(track: Record<string, unknown>) {
    const out = { ...track }
    if (Array.isArray(track.displays)) {
      out.displays = [...track.displays]
    }
    const id = readId(track)
    if (id !== undefined) {
      this.tracks.set(id, out)
    }
    return out
  }

  /** The list a held node belongs in, or undefined if its parent is gone. */
  listFor(held: HeldNode) {
    if (held.group === 'view' && held.parent === undefined) {
      return this.topViews
    }
    const owner =
      held.parent === undefined
        ? undefined
        : held.group === 'display'
          ? this.tracks.get(held.parent)
          : this.views.get(held.parent)
    if (!owner) {
      return undefined
    }
    const field =
      held.group === 'display'
        ? 'displays'
        : held.group === 'track'
          ? 'tracks'
          : 'views'
    if (!Array.isArray(owner[field])) {
      owner[field] = []
    }
    return owner[field] as unknown[]
  }
}

/**
 * Puts back every held node this build can now build, and returns the ones it
 * still cannot alongside the rebuilt snapshot.
 *
 * Ascending index within each target list, so a run of restores into one list
 * lands in the order they came out of it.
 */
function restoreHeldNodes(
  snapshot: Record<string, unknown>,
  registry: Registry,
) {
  const held = readHeld(snapshot)
  // canonicalized on the way back in, so a held node whose type has since been
  // renamed comes back under the name this build registers
  const restorable = held.flatMap(h => {
    const admitted = registry.admit(h.snapshot, h.group)
    return isRecord(admitted) ? [{ held: h, snapshot: admitted }] : []
  })
  if (restorable.length === 0) {
    return { snapshot, stillHeld: held }
  }
  const widgets = isRecord(snapshot.widgets) ? { ...snapshot.widgets } : {}
  const anchors = new Anchors(
    Array.isArray(snapshot.views) ? [...snapshot.views] : [],
  )
  const unplaceable: HeldNode[] = []
  for (const { held: h, snapshot: node } of [...restorable].sort(
    (a, b) => a.held.index - b.held.index,
  )) {
    if (h.group === 'widget') {
      if (h.key !== undefined) {
        widgets[h.key] = node
      }
      continue
    }
    const list = anchors.listFor(h)
    if (list) {
      list.splice(Math.min(h.index, list.length), 0, node)
    } else {
      unplaceable.push(h)
    }
  }
  const restored = new Set(restorable.map(r => r.held))
  const stillHeld = held.filter(h => !restored.has(h))
  return {
    snapshot: {
      ...snapshot,
      ...(isRecord(snapshot.widgets) ? { widgets } : {}),
      ...(Array.isArray(snapshot.views) ? { views: anchors.topViews } : {}),
    },
    stillHeld: [...stillHeld, ...unplaceable],
  }
}

/**
 * Takes the session-snapshot nodes whose pluggable type this plugin manager
 * cannot build out of the tree and holds them under `heldForMissingPlugins`,
 * and puts back the ones already held that it now can build. Returns the
 * snapshot unchanged (by identity) when there is nothing to do either way —
 * which is every session this build produced itself.
 */
export function pruneUnbuildableNodes(
  snapshot: Record<string, unknown>,
  pluginManager: PluginManager,
): { snapshot: Record<string, unknown>; dropped: UnbuildableNode[] } {
  const registry = new Registry(pluginManager)
  const restored = restoreHeldNodes(snapshot, registry)
  const prune: Prune = { registry, dropped: [], held: [], renamed: 0 }
  const input = restored.snapshot
  const pruned: Record<string, unknown> = {
    ...input,
    ...pruneWidgets(input, prune),
    ...(Array.isArray(input.views)
      ? {
          views: pruneList(input.views, 'view', prune, undefined, view =>
            pruneView(view, prune),
          ),
        }
      : {}),
  }
  const held = [...restored.stillHeld, ...prune.held]
  if (
    prune.dropped.length === 0 &&
    prune.renamed === 0 &&
    restored.snapshot === snapshot
  ) {
    return { snapshot, dropped: prune.dropped }
  }
  if (held.length > 0) {
    pruned[HELD_NODES_KEY] = held
  } else {
    delete pruned[HELD_NODES_KEY]
  }
  return { snapshot: pruned, dropped: prune.dropped }
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
