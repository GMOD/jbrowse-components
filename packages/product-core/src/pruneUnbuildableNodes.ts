import { pluggableElementTypeGroups } from '@jbrowse/core/PluginManager'
import {
  getPropertyMembers,
  getUnionSubtypes,
  isArrayType,
  isMapType,
  isModelType,
  isReferenceType,
  isType,
  isUnionType,
} from '@jbrowse/mobx-state-tree'

import { isRecord } from './snapshotUtils.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { PluggableElementTypeGroup } from '@jbrowse/core/PluginManager'
import type { IAnyModelType, IAnyType } from '@jbrowse/mobx-state-tree'

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
 * **The session schema is read off the session MST type, not written down here.**
 * One walk descends `(type, snapshot)` in lockstep: at any `types.array` or
 * `types.map` whose element type is one of the `pluggableMstType` unions it
 * admits, holds or restores each entry, and everywhere else it recurses
 * structurally. That is what reaches a synteny view's `levels[].tracks` and the
 * session's `connectionInstances`, which a hand-written list of `views` /
 * `tracks` / `displays` / `widgets` did not, and what will reach the next
 * container someone adds without anyone editing this file.
 *
 * **A node is held only when all three tests fail**: its `type` names no
 * registered element, no element declares it as an `alias`, and
 * the real MST union refuses the snapshot. The last two are what keep a renamed
 * type alive — an element can declare `aliases`, and a model's own
 * `preProcessSnapshot` can rewrite the type literal
 * (`LinearMultiSampleVariantDisplay` does both for the old
 * `MultiLinearVariantDisplay`), neither of which the registry's names show. The
 * first is what keeps this from quietly swallowing a *malformed* snapshot of a
 * type this build does have: that still throws, exactly as before, because
 * holding it would hide a real bug behind a message about plugins.
 */

type Group = PluggableElementTypeGroup

const HELD_NODES_KEY = 'heldForMissingPlugins'

export interface UnbuildableNode {
  group: Group
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
  group: Group
  /** map key, for a node that came out of a `types.map` */
  key?: string
  /**
   * id of the nearest enclosing node that has one — the view a track came out
   * of, the track a display came out of, the synteny level a level's track came
   * out of. Absent for a container on the session itself.
   */
  parent?: string
  /**
   * position in the list it came out of, so a restore lands where it was.
   * Absent for a map entry, which `key` places instead.
   */
  index?: number
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
function buildableElements(pluginManager: PluginManager, group: Group) {
  return pluginManager.getElementTypesInGroup(group).filter(t => {
    const { stateModel } = t as unknown as { stateModel?: unknown }
    return isType(stateModel) && isModelType(stateModel)
  }) as unknown as { name: string; aliases?: string[]; stateModel: IAnyType }[]
}

// optional/stripDefault/late/snapshotProcessor all report the type they wrap,
// so one loop reaches the array, map, model or union a property really declares.
function unwrapType(type: IAnyType) {
  let current = type
  for (let i = 0; i < 16; i++) {
    const sub = current.getSubTypes()
    if (
      !sub ||
      typeof sub !== 'object' ||
      Array.isArray(sub) ||
      sub === current
    ) {
      return current
    }
    current = sub
  }
  return current
}

// One prune's view of the plugin manager. The unions are built on first use, so
// a session naming only registered types — every session this build produced
// itself — never constructs one.
class Registry {
  private names = new Map<Group, Set<string>>()
  private aliases = new Map<Group, Map<string, string>>()
  private unions = new Map<Group, IAnyType>()
  private groups?: Map<IAnyType, Group>
  private discriminants = new Map<IAnyType, string | undefined>()

  constructor(private pluginManager: PluginManager) {}

  /**
   * The group a container holds, or undefined for a container of anything else.
   * Identified by member identity rather than by the union object, which
   * `pluggableMstType` rebuilds on every call: the members *are* the registered
   * `stateModel`s.
   */
  groupOf(elementType: IAnyType) {
    if (isReferenceType(elementType) || !isUnionType(elementType)) {
      return undefined
    }
    this.groups ??= new Map(
      pluggableElementTypeGroups.flatMap(group =>
        buildableElements(this.pluginManager, group).map(
          t => [t.stateModel, group] as const,
        ),
      ),
    )
    for (const member of getUnionSubtypes(elementType)) {
      const group = this.groups.get(member)
      if (group) {
        return group
      }
    }
    return undefined
  }

  /**
   * The name this build registers the node's type under — itself, or the
   * element that declares it as an alias — or undefined if neither does.
   */
  canonicalName(group: Group, type: string) {
    return this.namesFor(group).has(type)
      ? type
      : this.aliasesFor(group).get(type)
  }

  /**
   * The union member a node's type names, so the walk can descend into what
   * that concrete model declares. A type the registry cannot name has no
   * member to find; the node is then judged whole by `accepts`.
   */
  memberFor(elementType: IAnyType, type: string) {
    for (const member of getUnionSubtypes(elementType)) {
      if (this.discriminantOf(member) === type) {
        return member as IAnyModelType
      }
    }
    return undefined
  }

  /** Whether the real MST union takes this snapshot. */
  accepts(node: unknown, group: Group) {
    let union = this.unions.get(group)
    if (!union) {
      union = this.pluginManager.pluggableMstType(group, 'stateModel')
      this.unions.set(group, union)
    }
    return union.is(node)
  }

  private discriminantOf(member: IAnyType) {
    if (this.discriminants.has(member)) {
      return this.discriminants.get(member)
    }
    const literal = isModelType(member)
      ? (getPropertyMembers(member).properties.type as
          | { value?: unknown }
          | undefined)
      : undefined
    const value = typeof literal?.value === 'string' ? literal.value : undefined
    this.discriminants.set(member, value)
    return value
  }

  private namesFor(group: Group) {
    let names = this.names.get(group)
    if (!names) {
      names = new Set(
        buildableElements(this.pluginManager, group).map(t => t.name),
      )
      this.names.set(group, names)
    }
    return names
  }

  private aliasesFor(group: Group) {
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
}

function describe(node: unknown, group: Group): UnbuildableNode {
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

function anchorKey(group: Group, parent: string | undefined) {
  return `${group}/${parent ?? ''}`
}

function collectIds(value: unknown, into: Set<string>) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectIds(item, into)
    }
  } else if (isRecord(value)) {
    if (typeof value.id === 'string') {
      into.add(value.id)
    }
    for (const child of Object.values(value)) {
      collectIds(child, into)
    }
  }
}

interface Pending {
  held: HeldNode
  snapshot: Record<string, unknown>
}

class Walk {
  readonly dropped: UnbuildableNode[] = []
  readonly held: HeldNode[] = []
  /** anchors the walk reached, so an entry naming one it did not is orphaned */
  readonly anchors = new Set<string>()
  /** ids of nodes taken out, so a reference container can drop the danglers */
  readonly removed = new Set<string>()
  private pending = new Map<string, Pending[]>()
  // a node restored on this same call is walked like any other, so its own
  // unbuildable children come out again — but the user is told nothing, or a
  // held track whose displays are still missing warns on every load forever.
  private silence = 0
  private emptied = 0

  constructor(readonly registry: Registry) {}

  // counted rather than flagged, so the track that owns a display container
  // reads a difference across its own walk and needs no save-and-restore
  emptiedDisplays() {
    this.emptied++
  }

  emptiedDisplayCount() {
    return this.emptied
  }

  offer(entry: Pending) {
    const key = anchorKey(entry.held.group, entry.held.parent)
    const list = this.pending.get(key)
    if (list) {
      list.push(entry)
    } else {
      this.pending.set(key, [entry])
    }
  }

  take(group: Group, parent: string | undefined) {
    const key = anchorKey(group, parent)
    this.anchors.add(key)
    const taken = this.pending.get(key)
    this.pending.delete(key)
    return taken ?? []
  }

  /**
   * Entries no container claimed. A node whose subtree the walk descended into
   * is one the registry can name, and so one it admits — the single exception
   * is a track the cascade takes, which needs its display list to have come out
   * empty and so to have claimed nothing. Nothing a container takes can
   * therefore be discarded with the node around it.
   */
  unplaced() {
    return new Set([...this.pending.values()].flat().map(p => p.held))
  }

  drop(node: UnbuildableNode) {
    if (this.silence === 0) {
      this.dropped.push(node)
    }
  }

  quietly<T>(quiet: boolean, run: () => T) {
    this.silence += quiet ? 1 : 0
    try {
      return run()
    } finally {
      this.silence -= quiet ? 1 : 0
    }
  }
}

/**
 * Children first, then the node itself: the union's `is` validates a whole
 * subtree, so a view still holding an unbuildable track would be refused as a
 * whole and taken down with it. Returns undefined for a node this build cannot
 * hold, which the container then holds whole and unpruned.
 */
function pruneNode(
  node: unknown,
  group: Group,
  elementType: IAnyType,
  parent: string | undefined,
  walk: Walk,
): unknown {
  if (!isRecord(node)) {
    // MST reports a node with no readable type precisely; guessing at a repair
    // here would hide it
    return node
  }
  const type = node.type
  if (typeof type !== 'string') {
    return node
  }
  const canonical = walk.registry.canonicalName(group, type)
  const named =
    canonical === undefined || canonical === type
      ? node
      : { ...node, type: canonical }
  // only for a name the registry knows, which is exactly the set `accepts`
  // waves through: a node whose subtree the walk descends into is one it can
  // put back
  const model =
    canonical === undefined
      ? undefined
      : walk.registry.memberFor(elementType, canonical)
  const emptied = walk.emptiedDisplayCount()
  const pruned = model
    ? walkModel(model, named, readId(named) ?? parent, walk)
    : named
  const cascaded = group === 'track' && walk.emptiedDisplayCount() > emptied
  // A display type can go missing while its track type stays — a plugin
  // contributing one more display to an existing track type is the ordinary
  // case. A track left with none of them goes too: an empty `displays` array is
  // valid MST, so nothing downstream would refuse it, and `activeDisplay` reads
  // `displays[0]` on the promise that a shown track always has one.
  if (cascaded) {
    walk.drop({ ...describe(node, group), cascade: true })
    return undefined
  }
  // a registered name is admitted without asking the union, so a **malformed**
  // snapshot of a type this build does have still reaches MST and throws there
  if (canonical !== undefined || walk.registry.accepts(pruned, group)) {
    return pruned
  }
  walk.drop(describe(node, group))
  return undefined
}

// Returns the same list by identity when nothing moved, so a session this build
// produced itself comes back out of the whole walk as the object that went in.
function pruneArray(
  value: unknown,
  group: Group,
  elementType: IAnyType,
  parent: string | undefined,
  walk: Walk,
) {
  const list = Array.isArray(value) ? value : undefined
  const restoring = walk.take(group, parent)
  if (!list && restoring.length === 0) {
    return undefined
  }
  // ascending index, so a run of restores into one list lands in the order it
  // came out of it
  const merged = (list ?? []).map(node => ({ node, restored: false }))
  for (const entry of restoring.sort(
    (a, b) => (a.held.index ?? 0) - (b.held.index ?? 0),
  )) {
    merged.splice(
      Math.min(entry.held.index ?? merged.length, merged.length),
      0,
      {
        node: entry.snapshot,
        restored: true,
      },
    )
  }
  const out: unknown[] = []
  let changed = merged.length !== (list?.length ?? 0)
  for (const [index, { node, restored }] of merged.entries()) {
    const mark = walk.held.length
    const pruned = walk.quietly(restored, () =>
      pruneNode(node, group, elementType, parent, walk),
    )
    if (pruned !== undefined || !isRecord(node)) {
      changed ||= pruned !== node
      out.push(pruned)
      continue
    }
    // held whole and unpruned, and the entries its own children produced are
    // rolled back — so a dropped view's tracks are inside the copy of the view,
    // not separate entries anchored to a view that is no longer in the tree
    walk.held.length = mark
    walk.held.push({ group, parent, index, snapshot: node })
    const id = readId(node)
    if (id !== undefined) {
      walk.removed.add(id)
    }
    changed = true
  }
  // read by the track this container belongs to: a track left with none of its
  // displays goes too
  if (group === 'display' && out.length === 0 && (list?.length ?? 0) > 0) {
    walk.emptiedDisplays()
  }
  return changed || !list ? out : list
}

function pruneMap(
  value: unknown,
  group: Group,
  elementType: IAnyType,
  parent: string | undefined,
  walk: Walk,
) {
  const map = isRecord(value) ? value : undefined
  const restoring = walk.take(group, parent)
  if (!map && restoring.length === 0) {
    return undefined
  }
  const out: Record<string, unknown> = {}
  let changed = false
  for (const [key, node] of Object.entries(map ?? {})) {
    const mark = walk.held.length
    const pruned = pruneNode(node, group, elementType, parent, walk)
    if (pruned !== undefined || !isRecord(node)) {
      changed ||= pruned !== node
      out[key] = pruned
      continue
    }
    walk.held.length = mark
    walk.held.push({ group, key, parent, snapshot: node })
    walk.removed.add(readId(node) ?? key)
    changed = true
  }
  for (const entry of restoring) {
    const key = entry.held.key
    if (key === undefined) {
      continue
    }
    const mark = walk.held.length
    const pruned = walk.quietly(true, () =>
      pruneNode(entry.snapshot, group, elementType, parent, walk),
    )
    if (pruned === undefined) {
      walk.held.length = mark
      walk.held.push({ group, key, parent, snapshot: entry.snapshot })
    } else {
      out[key] = pruned
    }
    changed = true
  }
  return changed || !map ? out : map
}

function pruneContainer(
  type: IAnyType,
  elementType: IAnyType,
  group: Group,
  value: unknown,
  parent: string | undefined,
  walk: Walk,
) {
  return isMapType(type)
    ? pruneMap(value, group, elementType, parent, walk)
    : pruneArray(value, group, elementType, parent, walk)
}

// The model a record's snapshot is an instance of. A union that is not a
// pluggable one — `types.maybe(SomeModel)` — still has to resolve to the member
// the snapshot names, or the walk stops at a node whose children it could have
// reached.
function concreteModel(type: IAnyType, value: Record<string, unknown>) {
  if (isUnionType(type)) {
    const members = getUnionSubtypes(type).filter(
      m => isModelType(m) && !isUnionType(m),
    )
    if (members.length === 1) {
      return members[0] as IAnyModelType
    }
    return members.find(
      m =>
        (
          getPropertyMembers(m as IAnyModelType).properties.type as
            | { value?: unknown }
            | undefined
        )?.value === value.type,
    ) as IAnyModelType | undefined
  }
  return isModelType(type) ? type : undefined
}

function walkValue(
  declared: IAnyType,
  value: unknown,
  parent: string | undefined,
  walk: Walk,
): unknown {
  const type = unwrapType(declared)
  if (isArrayType(type) || isMapType(type)) {
    const elementType = unwrapType(type.getChildType())
    const group = walk.registry.groupOf(elementType)
    if (group) {
      return (
        pruneContainer(type, elementType, group, value, parent, walk) ?? value
      )
    }
    if (Array.isArray(value)) {
      const out = value.map(item => walkValue(elementType, item, parent, walk))
      return out.some((item, i) => item !== value[i]) ? out : value
    }
    if (isRecord(value)) {
      const entries = Object.entries(value).map(
        ([key, item]) =>
          [key, walkValue(elementType, item, parent, walk)] as const,
      )
      return entries.some(([key, item]) => item !== value[key])
        ? Object.fromEntries(entries)
        : value
    }
    return value
  }
  if (isRecord(value)) {
    const model = concreteModel(type, value)
    if (model) {
      return walkModel(model, value, readId(value) ?? parent, walk)
    }
  }
  return value
}

/**
 * Every property the model declares, not every key the snapshot has: a
 * container whose key MST stripped — `widgets` is `stripDefault(map(...), {})`,
 * so an empty drawer has no key at all — still has to be reached, or a held
 * widget has nowhere to come back to.
 */
function walkModel(
  model: IAnyModelType,
  node: Record<string, unknown>,
  parent: string | undefined,
  walk: Walk,
): Record<string, unknown> {
  const { properties } = getPropertyMembers(model)
  let out = node
  const write = (key: string, value: unknown) => {
    if (out === node) {
      out = { ...node }
    }
    out[key] = value
  }
  const references: string[] = []
  for (const [key, declared] of Object.entries(properties)) {
    const type = unwrapType(declared)
    const elementType =
      isArrayType(type) || isMapType(type)
        ? unwrapType(type.getChildType())
        : undefined
    if (elementType) {
      if (isReferenceType(elementType)) {
        references.push(key)
        continue
      }
      const group = walk.registry.groupOf(elementType)
      if (group) {
        const next = pruneContainer(
          type,
          elementType,
          group,
          node[key],
          parent,
          walk,
        )
        if (next !== undefined && next !== node[key]) {
          write(key, next)
        }
        continue
      }
    }
    const value = node[key]
    if (value === undefined) {
      continue
    }
    const next = walkValue(type, value, parent, walk)
    if (next !== value) {
      write(key, next)
    }
  }
  // After the value properties, so a reference into a sibling container sees
  // what that container dropped. `activeWidgets` holds safeReferences, which do
  // drop themselves when their target is gone, but only once something resolves
  // them — clearing them here keeps the pruned snapshot internally consistent
  // rather than relying on that. Deliberately not restored alongside their
  // target: a drawer panel that comes back closed costs a click, where a widget
  // that comes back missing costs the work in it.
  for (const key of references) {
    const value = out[key]
    if (!isRecord(value) || walk.removed.size === 0) {
      continue
    }
    const entries = Object.entries(value).filter(
      ([, id]) => typeof id !== 'string' || !walk.removed.has(id),
    )
    if (entries.length !== Object.keys(value).length) {
      write(key, Object.fromEntries(entries))
    }
  }
  return out
}

/**
 * Takes the session-snapshot nodes whose pluggable type this plugin manager
 * cannot build out of the tree and holds them under `heldForMissingPlugins`,
 * and puts back the ones already held that it now can build — in one walk of
 * the session type, so the two can never disagree about where a node lives.
 * Returns the snapshot unchanged (by identity) when there is nothing to do
 * either way, which is every session this build produced itself.
 */
export function pruneUnbuildableNodes(
  snapshot: Record<string, unknown>,
  pluginManager: PluginManager,
  sessionModelType: IAnyType,
): { snapshot: Record<string, unknown>; dropped: UnbuildableNode[] } {
  const registry = new Registry(pluginManager)
  const model = concreteModel(unwrapType(sessionModelType), snapshot)
  if (!model) {
    return { snapshot, dropped: [] }
  }
  const walk = new Walk(registry)
  const incoming = readHeld(snapshot)
  const restorable = new Set<HeldNode>()
  for (const entry of incoming) {
    // canonicalized on the way back in, so a held node whose type has since
    // been renamed comes back under the name this build registers
    const type = isRecord(entry.snapshot) ? entry.snapshot.type : undefined
    if (typeof type !== 'string') {
      continue
    }
    const canonical = registry.canonicalName(entry.group, type)
    if (
      canonical === undefined &&
      !registry.accepts(entry.snapshot, entry.group)
    ) {
      continue
    }
    restorable.add(entry)
    walk.offer({
      held: entry,
      snapshot:
        canonical === undefined || canonical === type
          ? entry.snapshot
          : { ...entry.snapshot, type: canonical },
    })
  }
  const pruned = walkModel(model, snapshot, undefined, walk)

  // An entry whose anchor the walk never reached has lost its container — the
  // recipient deleted the view a track hung off. `HeldNode` says such a node is
  // not restorable and is not meant to be, so it is collected here rather than
  // riding along in every autosave and every share link forever. Unless the
  // container is itself held: its snapshot is in this session too, just not in
  // the tree.
  const heldIds = new Set<string>()
  for (const entry of [...incoming, ...walk.held]) {
    collectIds(entry.snapshot, heldIds)
  }
  const unplaced = walk.unplaced()
  const stillHeld = incoming.filter(
    entry =>
      (!restorable.has(entry) || unplaced.has(entry)) &&
      (walk.anchors.has(anchorKey(entry.group, entry.parent)) ||
        (entry.parent !== undefined && heldIds.has(entry.parent))),
  )
  const held = [...stillHeld, ...walk.held]
  if (
    pruned === snapshot &&
    walk.held.length === 0 &&
    stillHeld.length === incoming.length
  ) {
    return { snapshot, dropped: walk.dropped }
  }
  const out: Record<string, unknown> = { ...pruned }
  if (held.length > 0) {
    out[HELD_NODES_KEY] = held
  } else {
    delete out[HELD_NODES_KEY]
  }
  return { snapshot: out, dropped: walk.dropped }
}

/**
 * The user-facing summary of one prune, or undefined when nothing was dropped.
 * Names the missing types rather than counting nodes: the plugin a person has to
 * install is the actionable half, and one missing display type can take several
 * nodes with it. Says what a person can do about it, because the nodes are not
 * gone — they ride along under `heldForMissingPlugins` and come back the moment
 * a build that has the plugin opens the session.
 */
export function describeUnbuildableNodes(dropped: UnbuildableNode[]) {
  const types = [
    ...new Set(dropped.flatMap(d => (d.cascade ? [] : [d.type]))),
  ].join(', ')
  return types
    ? `Kept but not shown, pending plugins this JBrowse does not have: ${types}. Install them and reload to get them back.`
    : undefined
}
