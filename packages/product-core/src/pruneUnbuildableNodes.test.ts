import { types } from '@jbrowse/mobx-state-tree'

import {
  describeUnbuildableNodes,
  pruneUnbuildableNodes,
} from './pruneUnbuildableNodes.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

// Stands in for a PluginManager on the two members the prune reads, plus the
// session type the prune now walks. A real one would drag every core plugin
// into a test about one missing plugin, and the registered models here carry
// the `type` literal every real state model does — which is what lets the union
// discriminate at all, and what the walk follows to reach a view's own
// containers.
//
// The shapes mirror the real tree rather than the prune's old field list: a
// view holds `tracks` and, like the linear-comparative family, per-level track
// lists under `levels[].tracks` and concrete child panels under `views`.
//
// `renames` gives one model the `preProcessSnapshot` type rewrite that
// LinearMultiSampleVariantDisplay uses for its old name: a type the registry
// cannot name and the union still accepts.
//
// `aliases` gives an element the declared-rename route instead: a legacy name
// the registry maps onto this one, which is `PluggableElementBase.aliases`.
function fakeBuild(
  groups: Record<string, string[]>,
  renames: Record<string, string> = {},
  aliases: Record<string, string[]> = {},
) {
  const elements: Record<
    string,
    { name: string; aliases?: string[]; stateModel: IAnyType }[]
  > = {}
  const pluggable = (group: string) =>
    types.late(() => {
      const models = (elements[group] ?? []).map(t => t.stateModel)
      return models.length > 0
        ? types.union(...models)
        : types.maybe(types.null)
    })
  const childPanel = types.model('ChildPanel', {
    id: types.identifier,
    type: types.string,
    tracks: types.array(pluggable('track')),
  })
  const level = types.model('Level', {
    id: types.identifier,
    tracks: types.array(pluggable('track')),
  })
  const shapeFor = (group: string): Record<string, IAnyType> => {
    if (group === 'view') {
      return {
        id: types.identifier,
        tracks: types.array(pluggable('track')),
        levels: types.array(level),
        views: types.array(childPanel),
      }
    }
    if (group === 'track') {
      return {
        id: types.identifier,
        displays: types.array(pluggable('display')),
      }
    }
    // `jexlFiltersSetting`'s spelling, on the model that really carries it. A
    // union ORs its members' TypeFlags upward, so this answers `isArrayType`
    // while being a `Union` with no `getChildType` — a walk that trusts the
    // flags throws on every session that reaches one.
    return {
      id: types.identifier,
      jexlFiltersSetting: types.maybe(types.array(types.string)),
    }
  }
  for (const [group, names] of Object.entries(groups)) {
    elements[group] = names.map(name => ({
      name,
      aliases: aliases[name],
      stateModel: types
        .model(name, { type: types.literal(name), ...shapeFor(group) })
        .preProcessSnapshot((snap: Record<string, unknown> | undefined) =>
          snap && renames[snap.type as string] === name
            ? { ...snap, type: name }
            : snap,
        ),
    }))
  }
  const pluginManager = {
    getElementTypesInGroup: (group: string) => elements[group] ?? [],
    pluggableMstType: (group: string) => pluggable(group),
  } as unknown as PluginManager
  const sessionType = types.model('FakeSession', {
    name: types.maybe(types.string),
    views: types.array(pluggable('view')),
    widgets: types.stripDefault(types.map(pluggable('widget')), {}),
    activeWidgets: types.stripDefault(
      types.map(types.safeReference(pluggable('widget'))),
      {},
    ),
    connectionInstances: types.stripDefault(
      types.array(pluggable('connection')),
      [],
    ),
    heldForMissingPlugins: types.frozen<unknown>(),
  })
  return { pluginManager, sessionType }
}

type Build = ReturnType<typeof fakeBuild>

function prune(snapshot: Record<string, unknown>, build: Build) {
  return pruneUnbuildableNodes(snapshot, build.pluginManager, build.sessionType)
}

const build = fakeBuild(
  {
    widget: ['HierarchicalTrackSelectorWidget'],
    view: ['LinearGenomeView', 'LinearSyntenyView'],
    track: ['FeatureTrack'],
    display: ['LinearBasicDisplay'],
    connection: ['UCSCTrackHubConnection'],
  },
  { OldBasicDisplay: 'LinearBasicDisplay' },
)

test('drops a widget whose plugin this build does not have', () => {
  const { snapshot, dropped } = prune(
    {
      name: 'shared',
      widgets: {
        ucscResults: { id: 'ucscResults', type: 'UcscResultsWidget' },
        hierarchical: {
          id: 'hierarchical',
          type: 'HierarchicalTrackSelectorWidget',
        },
      },
      activeWidgets: {
        ucscResults: 'ucscResults',
        hierarchical: 'hierarchical',
      },
    },
    build,
  )
  expect(Object.keys(snapshot.widgets as object)).toEqual(['hierarchical'])
  expect(snapshot.activeWidgets).toEqual({ hierarchical: 'hierarchical' })
  expect(dropped).toEqual([{ group: 'widget', type: 'UcscResultsWidget' }])
})

test('leaves a session it can build alone, by identity', () => {
  const snapshot = {
    name: 'mine',
    widgets: { h: { id: 'h', type: 'HierarchicalTrackSelectorWidget' } },
    views: [{ id: 'v', type: 'LinearGenomeView', tracks: [] }],
  }
  const pruned = prune(snapshot, build)
  expect(pruned.snapshot).toBe(snapshot)
  expect(pruned.dropped).toEqual([])
  expect(pruned.snapshot.heldForMissingPlugins).toBeUndefined()
})

test('drops an unbuildable view and an unbuildable track inside a kept one', () => {
  const { snapshot, dropped } = prune(
    {
      views: [
        { id: 'v1', type: 'SpreadsheetView' },
        {
          id: 'v2',
          type: 'LinearGenomeView',
          tracks: [
            { id: 't1', type: 'FeatureTrack', displays: [] },
            { id: 't2', type: 'MafTrack', displays: [] },
          ],
        },
      ],
    },
    build,
  )
  const views = snapshot.views as Record<string, unknown>[]
  expect(views.map(v => v.id)).toEqual(['v2'])
  expect(
    (views[0]!.tracks as Record<string, unknown>[]).map(t => t.id),
  ).toEqual(['t1'])
  expect(dropped).toEqual([
    { group: 'view', type: 'SpreadsheetView' },
    { group: 'track', type: 'MafTrack' },
  ])
})

// `pruneView` read exactly `view.tracks` and `view.views`, and the union
// short-circuits on the registered view name, so a synteny session's whole
// track list — `levels[].tracks`, two containers down — was never inspected.
// The prune returned the snapshot unchanged and MST threw on it a moment later,
// which is the exact failure this module exists to prevent.
test('reaches a track list nested under a view of its own, not just view.tracks', () => {
  const { snapshot, dropped } = prune(
    {
      views: [
        {
          id: 'syn',
          type: 'LinearSyntenyView',
          levels: [
            {
              id: 'level0',
              tracks: [
                { id: 't1', type: 'FeatureTrack', displays: [] },
                { id: 't2', type: 'LinearSyntenyTrack', displays: [] },
              ],
            },
          ],
        },
      ],
    },
    build,
  )
  const [view] = snapshot.views as Record<string, unknown>[]
  const [level] = view!.levels as Record<string, unknown>[]
  expect((level!.tracks as Record<string, unknown>[]).map(t => t.id)).toEqual([
    't1',
  ])
  expect(dropped).toEqual([{ group: 'track', type: 'LinearSyntenyTrack' }])
})

// The linear-comparative family and breakpoint-split hold their child panels as
// a concrete `types.array(LinearGenomeView.stateModel)`, not as the pluggable
// union — so the walk gets into them structurally rather than by admitting them.
test('recurses into the concrete child panels of a composite view', () => {
  const { snapshot, dropped } = prune(
    {
      views: [
        {
          id: 'bp',
          type: 'LinearSyntenyView',
          views: [
            {
              id: 'top',
              type: 'LinearGenomeView',
              tracks: [{ id: 't1', type: 'MafTrack', displays: [] }],
            },
          ],
        },
      ],
    },
    build,
  )
  const [composite] = snapshot.views as Record<string, unknown>[]
  const [panel] = composite!.views as Record<string, unknown>[]
  expect(panel!.tracks).toEqual([])
  expect(dropped).toEqual([{ group: 'track', type: 'MafTrack' }])
})

// `connectionInstances` is another `pluggableMstType` array the field list did
// not name. It is stripped on the way out by finalizeSession's postProcessor,
// so only an authored defaultSession or session.json reaches it — which is
// exactly the snapshot nobody controls.
test('drops a connection whose plugin this build does not have', () => {
  const { snapshot, dropped } = prune(
    {
      connectionInstances: [
        { id: 'c1', type: 'UCSCTrackHubConnection' },
        { id: 'c2', type: 'CustomConnection' },
      ],
    },
    build,
  )
  expect(
    (snapshot.connectionInstances as Record<string, unknown>[]).map(c => c.id),
  ).toEqual(['c1'])
  expect(dropped).toEqual([{ group: 'connection', type: 'CustomConnection' }])
})

// THE FLAGS LIE ON A UNION. `types.maybe(types.array(types.string))` — the
// sentinel spelling every jexl-filter setting uses — reports `isArrayType`,
// because a union ORs its members' TypeFlags upward, while being a `Union` with
// no `getChildType`. A walk that branched on the flags threw
// `type.getChildType is not a function` out of `setSession` for every session
// that reached a display, which is every real one; the fake build's shapes gave
// no property this shape and nothing here saw it.
test('walks past a maybe-wrapped array without mistaking it for a container', () => {
  const snapshot = {
    widgets: {
      h: {
        id: 'h',
        type: 'HierarchicalTrackSelectorWidget',
        jexlFiltersSetting: ['jexl:true'],
      },
    },
  }
  const pruned = prune(snapshot, build)
  expect(pruned.snapshot).toBe(snapshot)
  expect(pruned.dropped).toEqual([])
})

// A plugin contributing one more display to an existing track type is ordinary,
// so the display can go while the track type stays. A track left with none of
// them has nothing to render and code downstream reads displays[0].
test('drops a display it cannot build, and the track when that empties it', () => {
  const { snapshot, dropped } = prune(
    {
      views: [
        {
          id: 'v',
          type: 'LinearGenomeView',
          tracks: [
            {
              id: 't1',
              type: 'FeatureTrack',
              displays: [
                { id: 'd1', type: 'LinearBasicDisplay' },
                { id: 'd2', type: 'LinearGwasDisplay' },
              ],
            },
            {
              id: 't2',
              type: 'FeatureTrack',
              displays: [{ id: 'd3', type: 'LinearGwasDisplay' }],
            },
          ],
        },
      ],
    },
    build,
  )
  const [view] = snapshot.views as Record<string, unknown>[]
  const tracks = view!.tracks as Record<string, unknown>[]
  expect(tracks.map(t => t.id)).toEqual(['t1'])
  expect(
    (tracks[0]!.displays as Record<string, unknown>[]).map(d => d.id),
  ).toEqual(['d1'])
  expect(dropped).toEqual([
    { group: 'display', type: 'LinearGwasDisplay' },
    { group: 'display', type: 'LinearGwasDisplay' },
    { group: 'track', type: 'FeatureTrack', cascade: true },
  ])
  // FeatureTrack is not a missing plugin — it went with its displays
  expect(describeUnbuildableNodes(dropped)).toBe(
    'Kept but not shown, pending plugins this JBrowse does not have: LinearGwasDisplay. Install them and reload to get them back.',
  )
})

// A registry name is not the whole story: a DisplayType can declare `aliases`
// and a model's own preProcessSnapshot can rewrite the type literal, so a
// renamed type appears unregistered while the union accepts it happily. Asking
// only the registry dropped the old name and left the track with no display —
// which is how the LinearMultiSampleVariantDisplay rename first showed up.
test('keeps a renamed type the union still accepts', () => {
  const { snapshot, dropped } = prune(
    {
      views: [
        {
          id: 'v',
          type: 'LinearGenomeView',
          tracks: [
            {
              id: 't',
              type: 'FeatureTrack',
              displays: [{ id: 'd', type: 'OldBasicDisplay' }],
            },
          ],
        },
      ],
    },
    build,
  )
  expect(dropped).toEqual([])
  const [view] = snapshot.views as Record<string, unknown>[]
  const [track] = view!.tracks as Record<string, unknown>[]
  expect(track!.displays).toEqual([{ id: 'd', type: 'OldBasicDisplay' }])
})

test('describeUnbuildableNodes names each distinct type once', () => {
  expect(describeUnbuildableNodes([])).toBeUndefined()
  expect(
    describeUnbuildableNodes([
      { group: 'widget', type: 'UcscResultsWidget' },
      { group: 'view', type: 'SpreadsheetView' },
      { group: 'view', type: 'SpreadsheetView' },
    ]),
  ).toBe(
    'Kept but not shown, pending plugins this JBrowse does not have: UcscResultsWidget, SpreadsheetView. Install them and reload to get them back.',
  )
})

// The build that has the plugins the sessions above are missing. Restoring is
// the same call: a prune by a build that can hold a held node puts it back.
const withPlugins = fakeBuild({
  widget: ['HierarchicalTrackSelectorWidget', 'UcscResultsWidget'],
  view: ['LinearGenomeView', 'LinearSyntenyView', 'SpreadsheetView'],
  track: ['FeatureTrack', 'MafTrack'],
  display: ['LinearBasicDisplay', 'LinearGwasDisplay'],
  connection: ['UCSCTrackHubConnection'],
})

// A prune that merely drops is destructive the moment the session is written
// back: jbrowse-web autosaves getSnapshot(session) on a 400ms debounce, so
// opening a shared link without the plugin overwrites the stored row and the
// nodes are gone for good — for the recipient, and for anyone they reshare to.
// Holding them makes the drop a round trip instead.
test('holds a dropped view and gives it back to a build that has the plugin', () => {
  const original = {
    views: [
      { id: 'v1', type: 'SpreadsheetView' },
      { id: 'v2', type: 'LinearGenomeView', tracks: [] },
    ],
  }
  const { snapshot } = prune(original, build)
  expect((snapshot.views as unknown[]).length).toBe(1)

  const { snapshot: restored, dropped } = prune(snapshot, withPlugins)
  expect(dropped).toEqual([])
  expect(restored.views).toEqual(original.views)
  expect(restored.heldForMissingPlugins).toBeUndefined()
})

test('gives a held track back to its own view, at the index it came from', () => {
  const original = {
    views: [
      {
        id: 'v',
        type: 'LinearGenomeView',
        tracks: [
          { id: 't1', type: 'FeatureTrack', displays: [] },
          { id: 't2', type: 'MafTrack', displays: [] },
          { id: 't3', type: 'FeatureTrack', displays: [] },
        ],
      },
    ],
  }
  const { snapshot } = prune(original, build)
  const { snapshot: restored } = prune(snapshot, withPlugins)
  expect(restored.views).toEqual(original.views)
})

// The level, not the view, is the anchor: a synteny view holds one track list
// per level and `trackContainerFor` addresses them by the level's own id.
test('gives a held track back to the level it came out of', () => {
  const original = {
    views: [
      {
        id: 'syn',
        type: 'LinearSyntenyView',
        levels: [
          {
            id: 'level0',
            tracks: [
              { id: 't1', type: 'FeatureTrack', displays: [] },
              { id: 't2', type: 'MafTrack', displays: [] },
            ],
          },
        ],
      },
    ],
  }
  const { snapshot } = prune(original, build)
  const { snapshot: restored } = prune(snapshot, withPlugins)
  expect(restored.views).toEqual(original.views)
})

test('gives a held display back to its track, and un-cascades the track', () => {
  const original = {
    views: [
      {
        id: 'v',
        type: 'LinearGenomeView',
        tracks: [
          {
            id: 't1',
            type: 'FeatureTrack',
            displays: [
              { id: 'd1', type: 'LinearBasicDisplay' },
              { id: 'd2', type: 'LinearGwasDisplay' },
            ],
          },
          {
            id: 't2',
            type: 'FeatureTrack',
            displays: [{ id: 'd3', type: 'LinearGwasDisplay' }],
          },
        ],
      },
    ],
  }
  const { snapshot } = prune(original, build)
  const { snapshot: restored } = prune(snapshot, withPlugins)
  expect(restored.views).toEqual(original.views)
})

test('gives a held widget back under its own key', () => {
  const original = {
    widgets: {
      ucscResults: { id: 'ucscResults', type: 'UcscResultsWidget' },
      hierarchical: {
        id: 'hierarchical',
        type: 'HierarchicalTrackSelectorWidget',
      },
    },
    activeWidgets: { ucscResults: 'ucscResults' },
  }
  const { snapshot } = prune(original, build)
  const { snapshot: restored } = prune(snapshot, withPlugins)
  expect(restored.widgets).toEqual(original.widgets)
})

// `widgets` is `stripDefault(map(...), {})`, so a drawer holding only the
// unbuildable widget autosaves with no `widgets` key at all. The restore used
// to write into a local object it then discarded unless the incoming snapshot
// already had the key — so the one session where holding a widget mattered was
// the one where the held widget was destroyed on the way back.
test('gives back the only widget there was, from a snapshot with no widgets key', () => {
  const { snapshot } = prune(
    {
      widgets: {
        ucscResults: { id: 'ucscResults', type: 'UcscResultsWidget' },
      },
    },
    build,
  )
  expect(snapshot.widgets).toEqual({})
  delete snapshot.widgets

  const { snapshot: restored } = prune(snapshot, withPlugins)
  expect(restored.widgets).toEqual({
    ucscResults: { id: 'ucscResults', type: 'UcscResultsWidget' },
  })
  expect(restored.heldForMissingPlugins).toBeUndefined()
})

// The recipient without the plugin opens it, edits, saves, reshares. The held
// node has to survive that unchanged rather than accumulating a second copy —
// and the merge that keeps it once only runs on a prune that restores something
// else at the same time, which is the arm the identity short-circuit skips.
test('a second prune by another build holds the node once, not twice', () => {
  const other = fakeBuild({
    widget: ['UcscResultsWidget'],
    view: ['LinearGenomeView'],
    track: ['FeatureTrack'],
    display: ['LinearBasicDisplay'],
  })
  const original = {
    widgets: { u: { id: 'u', type: 'UcscResultsWidget' } },
    views: [
      { id: 'v1', type: 'SpreadsheetView' },
      { id: 'v2', type: 'LinearGenomeView', tracks: [] },
    ],
  }
  const once = prune(original, build).snapshot
  expect((once.heldForMissingPlugins as unknown[]).length).toBe(2)

  // `other` restores the widget and still cannot build SpreadsheetView
  const twice = prune(once, other).snapshot
  expect(twice.widgets).toEqual(original.widgets)
  expect(twice.heldForMissingPlugins).toEqual([
    {
      group: 'view',
      parent: undefined,
      index: 0,
      snapshot: { id: 'v1', type: 'SpreadsheetView' },
    },
  ])
})

// The first of the prune's two tests is what keeps a malformed snapshot of a
// type this build DOES have from being swallowed. Holding must not weaken it:
// that node is a real bug and still has to reach MST.
test('does not hold a malformed snapshot of a type it does have', () => {
  const { snapshot, dropped } = prune(
    { views: [{ id: 'v', type: 'LinearGenomeView', bpPerPx: 'not-a-number' }] },
    build,
  )
  expect(dropped).toEqual([])
  expect(snapshot.heldForMissingPlugins).toBeUndefined()
})

// `aliases` used to be DisplayType's alone, so renaming a track type or a view
// type had no declared route at all — only the central `displayTypeMap` in
// sessionMigrations, which a plugin outside this repo cannot add to. On
// PluggableElementBase it covers every group the prune walks.
const withAliases = fakeBuild(
  {
    widget: ['HierarchicalTrackSelectorWidget'],
    view: ['LinearGenomeView'],
    track: ['FeatureTrack'],
    display: ['LinearBasicDisplay'],
  },
  {},
  {
    LinearGenomeView: ['LinearGenomeViewPlugin'],
    FeatureTrack: ['BasicTrack'],
    HierarchicalTrackSelectorWidget: ['HierarchicalTrackSelector'],
  },
)

test('renames an aliased view, track and widget instead of holding them', () => {
  const { snapshot, dropped } = prune(
    {
      widgets: { h: { id: 'h', type: 'HierarchicalTrackSelector' } },
      views: [
        {
          id: 'v',
          type: 'LinearGenomeViewPlugin',
          tracks: [
            {
              id: 't',
              type: 'BasicTrack',
              displays: [{ id: 'd', type: 'LinearBasicDisplay' }],
            },
          ],
        },
      ],
    },
    withAliases,
  )
  expect(dropped).toEqual([])
  expect(snapshot.heldForMissingPlugins).toBeUndefined()
  const [view] = snapshot.views as Record<string, unknown>[]
  expect(view!.type).toBe('LinearGenomeView')
  expect((view!.tracks as Record<string, unknown>[])[0]!.type).toBe(
    'FeatureTrack',
  )
  expect((snapshot.widgets as Record<string, any>).h.type).toBe(
    'HierarchicalTrackSelectorWidget',
  )
})

// The two mechanisms have to compose: a node held while its plugin was missing
// comes back under whatever name the build that has the plugin registers, not
// the one it was written under.
test('gives a held node back under the name the alias points at', () => {
  const { snapshot } = prune(
    { views: [{ id: 'v', type: 'LinearGenomeViewPlugin', tracks: [] }] },
    fakeBuild({ view: ['SpreadsheetView'] }),
  )
  expect((snapshot.heldForMissingPlugins as unknown[]).length).toBe(1)

  const { snapshot: restored, dropped } = prune(snapshot, withAliases)
  expect(dropped).toEqual([])
  expect(restored.views).toEqual([
    { id: 'v', type: 'LinearGenomeView', tracks: [] },
  ])
  expect(restored.heldForMissingPlugins).toBeUndefined()
})

// A held track whose displays this build still cannot build comes back, is
// pruned again and is held again — all correct, and all silent. Reporting it
// would fire the snackbar on every single load, forever, for a node the user
// has already been told about and cannot do anything more about.
test('says nothing about a node it restored and held again on the same call', () => {
  const original = {
    views: [
      {
        id: 'v',
        type: 'LinearGenomeView',
        tracks: [
          {
            id: 't',
            type: 'FeatureTrack',
            displays: [{ id: 'd', type: 'LinearGwasDisplay' }],
          },
        ],
      },
    ],
  }
  const once = prune(original, build)
  expect(once.dropped).toEqual([
    { group: 'display', type: 'LinearGwasDisplay' },
    { group: 'track', type: 'FeatureTrack', cascade: true },
  ])

  const twice = prune(once.snapshot, build)
  expect(twice.dropped).toEqual([])
  expect(twice.snapshot.heldForMissingPlugins).toEqual(
    once.snapshot.heldForMissingPlugins,
  )
})

// A held node whose anchor is gone rides along in every autosave and every
// share link otherwise. `HeldNode` says such a node is not restorable and is
// not meant to be: the container going is the user saying so.
test('collects a held node whose view the recipient has since deleted', () => {
  const original = {
    views: [
      {
        id: 'v',
        type: 'LinearGenomeView',
        tracks: [{ id: 't', type: 'MafTrack', displays: [] }],
      },
    ],
  }
  const { snapshot } = prune(original, build)
  expect((snapshot.heldForMissingPlugins as unknown[]).length).toBe(1)

  const emptied = { ...snapshot, views: [] }
  const { snapshot: swept } = prune(emptied, withPlugins)
  expect(swept.heldForMissingPlugins).toBeUndefined()
  expect(swept.views).toEqual([])
})

// ...and ONLY when it is really gone. `ElementId` is
// `types.optional(types.identifier, createElementId)`, so a hand-authored
// defaultSession names no track id and MST mints one on instantiation — which
// jbrowse-web then autosaves. A held display anchored to the id-less track fell
// back to the VIEW's id, so on the next load the walk registered
// `display/<mintedTrackId>` and the entry's `display/<viewId>` matched no anchor
// it had reached. Collecting on that reads a container the reader still has as
// one they deleted, and the message promising the node back was a lie: the
// entry is gone from the autosave and from every share link made after it.
test('keeps a held node whose container is still there under a minted id', () => {
  // a second, buildable display, so the track survives and the held entry is
  // the DISPLAY — anchored to the track, which is the node with no authored id
  const kept = { id: 'd', type: 'LinearBasicDisplay' }
  const authored = {
    views: [
      {
        id: 'v',
        type: 'LinearGenomeView',
        tracks: [
          { type: 'FeatureTrack', displays: [{ type: 'MafDisplay' }, kept] },
        ],
      },
    ],
  }
  const { snapshot } = prune(authored, build)
  expect(
    (snapshot.heldForMissingPlugins as { group: string; parent: string }[])[0],
  ).toMatchObject({ group: 'display', parent: 'v' })

  // what MST hands back once the session is built and autosaved
  const autosaved = {
    ...snapshot,
    views: [
      {
        id: 'v',
        type: 'LinearGenomeView',
        tracks: [{ id: 'minted', type: 'FeatureTrack', displays: [kept] }],
      },
    ],
  }
  const { snapshot: again } = prune(autosaved, build)
  expect(again.heldForMissingPlugins).toEqual(snapshot.heldForMissingPlugins)
})

// Unless the container is only held rather than deleted: its snapshot is still
// in this session, so the node it anchors has somewhere to go the moment a
// build that can hold both opens it. Three loads by two different plugin sets
// is what it takes to separate the two — the display is anchored to a track
// that is inside a held view, so no container the walk reaches names it.
test('keeps a held node whose container is itself held', () => {
  const noGwas = prune(
    {
      views: [
        {
          id: 'v',
          type: 'LinearGenomeView',
          tracks: [
            {
              id: 't',
              type: 'FeatureTrack',
              displays: [
                { id: 'd1', type: 'LinearBasicDisplay' },
                { id: 'd2', type: 'LinearGwasDisplay' },
              ],
            },
          ],
        },
      ],
    },
    build,
  ).snapshot

  const gwasNoLgv = fakeBuild({
    view: ['SpreadsheetView'],
    track: ['FeatureTrack'],
    display: ['LinearBasicDisplay', 'LinearGwasDisplay'],
  })
  const held = prune(noGwas, gwasNoLgv).snapshot
  expect(
    (held.heldForMissingPlugins as { group: string }[]).map(h => h.group),
  ).toEqual(['display', 'view'])

  const again = prune(held, gwasNoLgv).snapshot
  expect(again.heldForMissingPlugins).toEqual(held.heldForMissingPlugins)
})

test('holds a display whose lazy state model is not loaded, without reading it', () => {
  const lazy = fakeBuild({
    view: ['LinearGenomeView'],
    track: ['FeatureTrack'],
    display: ['LinearBasicDisplay'],
  })
  const registered = lazy.pluginManager.getElementTypesInGroup
  const unloaded = {
    name: 'LinearGwasDisplay',
    isStateModelLoaded: false,
    get stateModel(): IAnyType {
      throw new Error('not loaded')
    },
  }
  lazy.pluginManager.getElementTypesInGroup = (group =>
    group === 'display'
      ? [...registered(group), unloaded]
      : registered(group)) as typeof registered
  const { dropped } = prune(
    {
      views: [
        {
          id: 'v',
          type: 'LinearGenomeView',
          tracks: [
            {
              id: 't',
              type: 'FeatureTrack',
              displays: [{ id: 'd', type: 'LinearGwasDisplay' }],
            },
          ],
        },
      ],
    },
    lazy,
  )
  expect(dropped).toEqual([
    { group: 'display', type: 'LinearGwasDisplay' },
    { group: 'track', type: 'FeatureTrack', cascade: true },
  ])
})
