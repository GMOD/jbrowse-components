import { types } from '@jbrowse/mobx-state-tree'

import {
  describeUnbuildableNodes,
  pruneUnbuildableNodes,
} from './pruneUnbuildableNodes.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// Stands in for a PluginManager on the two members the prune reads. A real one
// would drag every core plugin into a test about one missing plugin, and the
// registered models here carry the `type` literal every real state model does —
// which is what lets the union discriminate at all.
//
// `renames` gives one model the `preProcessSnapshot` type rewrite that
// LinearMultiSampleVariantDisplay uses for its old name: a type the registry
// cannot name and the union still accepts.
//
// `aliases` gives an element the declared-rename route instead: a legacy name
// the registry maps onto this one, which is `PluggableElementBase.aliases`.
function fakePluginManager(
  groups: Record<string, string[]>,
  renames: Record<string, string> = {},
  aliases: Record<string, string[]> = {},
) {
  const elements = Object.fromEntries(
    Object.entries(groups).map(([group, names]) => [
      group,
      names.map(name => ({
        name,
        aliases: aliases[name],
        stateModel: types
          .model(name, { type: types.literal(name) })
          .preProcessSnapshot((snap: Record<string, unknown> | undefined) =>
            snap && renames[snap.type as string] === name
              ? { ...snap, type: name }
              : snap,
          ),
      })),
    ]),
  )
  return {
    getElementTypesInGroup: (group: string) => elements[group] ?? [],
    pluggableMstType: (group: string) => {
      const models = (elements[group] ?? []).map(t => t.stateModel)
      return models.length > 0
        ? types.union(...models)
        : types.maybe(types.null)
    },
  } as unknown as PluginManager
}

const pluginManager = fakePluginManager(
  {
    widget: ['HierarchicalTrackSelectorWidget'],
    view: ['LinearGenomeView', 'BreakpointSplitView'],
    track: ['FeatureTrack'],
    display: ['LinearBasicDisplay'],
  },
  { OldBasicDisplay: 'LinearBasicDisplay' },
)

test('drops a widget whose plugin this build does not have', () => {
  const { snapshot, dropped } = pruneUnbuildableNodes(
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
    pluginManager,
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
  const pruned = pruneUnbuildableNodes(snapshot, pluginManager)
  expect(pruned.snapshot).toBe(snapshot)
  expect(pruned.dropped).toEqual([])
})

test('drops an unbuildable view and an unbuildable track inside a kept one', () => {
  const { snapshot, dropped } = pruneUnbuildableNodes(
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
    pluginManager,
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

test('recurses into the child views of a composite view', () => {
  const { snapshot, dropped } = pruneUnbuildableNodes(
    {
      views: [
        {
          id: 'bp',
          type: 'BreakpointSplitView',
          views: [
            { id: 'top', type: 'LinearGenomeView' },
            { id: 'bottom', type: 'DotplotView' },
          ],
        },
      ],
    },
    pluginManager,
  )
  const [composite] = snapshot.views as Record<string, unknown>[]
  expect(
    (composite!.views as Record<string, unknown>[]).map(v => v.id),
  ).toEqual(['top'])
  expect(dropped).toEqual([{ group: 'view', type: 'DotplotView' }])
})

// A plugin contributing one more display to an existing track type is ordinary,
// so the display can go while the track type stays. A track left with none of
// them has nothing to render and code downstream reads displays[0].
test('drops a display it cannot build, and the track when that empties it', () => {
  const { snapshot, dropped } = pruneUnbuildableNodes(
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
    pluginManager,
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
    'Removed session items that need plugins this JBrowse does not have: LinearGwasDisplay',
  )
})

// A registry name is not the whole story: a DisplayType can declare `aliases`
// and a model's own preProcessSnapshot can rewrite the type literal, so a
// renamed type appears unregistered while the union accepts it happily. Asking
// only the registry dropped the old name and left the track with no display —
// which is how the LinearMultiSampleVariantDisplay rename first showed up.
test('keeps a renamed type the union still accepts', () => {
  const { snapshot, dropped } = pruneUnbuildableNodes(
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
    pluginManager,
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
    'Removed session items that need plugins this JBrowse does not have: UcscResultsWidget, SpreadsheetView',
  )
})

// The build that has the plugins the sessions above are missing. Restoring is
// the same call: a prune by a build that can hold a held node puts it back.
const withPlugins = fakePluginManager({
  widget: ['HierarchicalTrackSelectorWidget', 'UcscResultsWidget'],
  view: ['LinearGenomeView', 'BreakpointSplitView', 'SpreadsheetView'],
  track: ['FeatureTrack', 'MafTrack'],
  display: ['LinearBasicDisplay', 'LinearGwasDisplay'],
})

// A prune that merely drops is destructive the moment the session is written
// back: jbrowse-web autosaves getSnapshot(session) on a 400ms debounce, so
// opening a shared link without the plugin overwrites the stored row and the
// nodes are gone for good — for the recipient, and for anyone they reshare to.
// Holding them makes the drop a round trip instead.
test('holds a dropped view and gives it back to a build that has the plugin', () => {
  const original = {
    views: [
      { id: 'v1', type: 'SpreadsheetView', rowCount: 7 },
      { id: 'v2', type: 'LinearGenomeView', tracks: [] },
    ],
  }
  const { snapshot } = pruneUnbuildableNodes(original, pluginManager)
  expect((snapshot.views as unknown[]).length).toBe(1)

  const { snapshot: restored, dropped } = pruneUnbuildableNodes(
    snapshot,
    withPlugins,
  )
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
  const { snapshot } = pruneUnbuildableNodes(original, pluginManager)
  const { snapshot: restored } = pruneUnbuildableNodes(snapshot, withPlugins)
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
  const { snapshot } = pruneUnbuildableNodes(original, pluginManager)
  const { snapshot: restored } = pruneUnbuildableNodes(snapshot, withPlugins)
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
  const { snapshot } = pruneUnbuildableNodes(original, pluginManager)
  const { snapshot: restored } = pruneUnbuildableNodes(snapshot, withPlugins)
  expect(restored.widgets).toEqual(original.widgets)
})

// The recipient without the plugin opens it, edits, saves, reshares. The held
// node has to survive that unchanged rather than accumulating a second copy.
test('a second prune by the same build holds the node once, not twice', () => {
  const original = {
    views: [
      { id: 'v1', type: 'SpreadsheetView' },
      { id: 'v2', type: 'LinearGenomeView', tracks: [] },
    ],
  }
  const once = pruneUnbuildableNodes(original, pluginManager).snapshot
  const twice = pruneUnbuildableNodes(once, pluginManager).snapshot
  expect(twice.heldForMissingPlugins).toEqual(once.heldForMissingPlugins)
  expect((twice.heldForMissingPlugins as unknown[]).length).toBe(1)
})

test('holds nothing, and keeps snapshot identity, when it can build everything', () => {
  const snapshot = {
    widgets: { h: { id: 'h', type: 'HierarchicalTrackSelectorWidget' } },
    views: [{ id: 'v', type: 'LinearGenomeView', tracks: [] }],
  }
  const pruned = pruneUnbuildableNodes(snapshot, pluginManager)
  expect(pruned.snapshot).toBe(snapshot)
  expect(pruned.snapshot.heldForMissingPlugins).toBeUndefined()
})

// The first of the prune's two tests is what keeps a malformed snapshot of a
// type this build DOES have from being swallowed. Holding must not weaken it:
// that node is a real bug and still has to reach MST.
test('does not hold a malformed snapshot of a type it does have', () => {
  const { snapshot, dropped } = pruneUnbuildableNodes(
    {
      views: [{ id: 'v', type: 'LinearGenomeView', bpPerPx: 'not-a-number' }],
    },
    pluginManager,
  )
  expect(dropped).toEqual([])
  expect(snapshot.heldForMissingPlugins).toBeUndefined()
})

// `aliases` used to be DisplayType's alone, so renaming a track type or a view
// type had no declared route at all — only the central `displayTypeMap` in
// sessionMigrations, which a plugin outside this repo cannot add to. On
// PluggableElementBase it covers every group the prune walks.
const withAliases = fakePluginManager(
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
  const { snapshot, dropped } = pruneUnbuildableNodes(
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
  const { snapshot } = pruneUnbuildableNodes(
    { views: [{ id: 'v', type: 'LinearGenomeViewPlugin', tracks: [] }] },
    fakePluginManager({ view: ['SpreadsheetView'] }),
  )
  expect((snapshot.heldForMissingPlugins as unknown[]).length).toBe(1)

  const { snapshot: restored, dropped } = pruneUnbuildableNodes(
    snapshot,
    withAliases,
  )
  expect(dropped).toEqual([])
  expect(restored.views).toEqual([
    { id: 'v', type: 'LinearGenomeView', tracks: [] },
  ])
  expect(restored.heldForMissingPlugins).toBeUndefined()
})
