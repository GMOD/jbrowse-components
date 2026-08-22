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
function fakePluginManager(
  groups: Record<string, string[]>,
  renames: Record<string, string> = {},
  lazyGroups: Record<string, string[]> = {},
) {
  const elements = Object.fromEntries(
    Object.entries(groups).map(([group, names]) => [
      group,
      [
        ...names.map(name => ({
          name,
          stateModel: types
            .model(name, { type: types.literal(name) })
            .preProcessSnapshot((snap: Record<string, unknown> | undefined) =>
              snap && renames[snap.type as string] === name
                ? { ...snap, type: name }
                : snap,
            ),
        })),
        // registered like a lazy ViewType: a loader in place of a model
        ...(lazyGroups[group] ?? []).map(name => ({
          name,
          stateModelLoader: () =>
            Promise.resolve(types.model(name, { type: types.literal(name) })),
        })),
      ],
    ]),
  )
  return {
    getElementTypesInGroup: (group: string) => elements[group] ?? [],
    pluggableMstType: (group: string) => {
      const models = (elements[group] ?? []).flatMap(t =>
        'stateModel' in t ? [t.stateModel] : [],
      )
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

test('keeps a view whose type is registered with an unloaded lazy state model, and reports it', () => {
  const pm = fakePluginManager(
    { view: ['LinearGenomeView'], widget: [], track: [], display: [] },
    {},
    { view: ['DotplotView'] },
  )
  const { snapshot, dropped, needsLoad } = pruneUnbuildableNodes(
    {
      name: 'shared',
      views: [
        { id: 'a', type: 'LinearGenomeView' },
        { id: 'b', type: 'DotplotView' },
        { id: 'c', type: 'NoSuchView' },
      ],
    },
    pm,
  )
  expect((snapshot.views as { type: string }[]).map(v => v.type)).toEqual([
    'LinearGenomeView',
    'DotplotView',
  ])
  expect(dropped).toEqual([{ group: 'view', type: 'NoSuchView' }])
  expect(needsLoad).toEqual([{ group: 'view', type: 'DotplotView' }])
})

test('collects lazy view types from the child views of a composite view', () => {
  const pm = fakePluginManager(
    { view: ['BreakpointSplitView'], widget: [], track: [], display: [] },
    {},
    { view: ['DotplotView'] },
  )
  const { needsLoad } = pruneUnbuildableNodes(
    {
      name: 'shared',
      views: [
        {
          id: 'a',
          type: 'BreakpointSplitView',
          views: [{ id: 'b', type: 'DotplotView' }],
        },
      ],
    },
    pm,
  )
  expect(needsLoad).toEqual([{ group: 'view', type: 'DotplotView' }])
})

test('reports nothing to load when every named type is eagerly registered', () => {
  const { needsLoad } = pruneUnbuildableNodes(
    { name: 'shared', views: [{ id: 'a', type: 'LinearGenomeView' }] },
    pluginManager,
  )
  expect(needsLoad).toEqual([])
})
