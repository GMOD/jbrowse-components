import { types } from '@jbrowse/mobx-state-tree'

import {
  describeUnbuildableNodes,
  pruneUnbuildableNodes,
} from './pruneUnbuildableNodes.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// Only `getElementTypesInGroup` is read, and only for the name + stateModel of
// each registered type — a real PluginManager here would drag every core plugin
// into a test about one missing one.
function fakePluginManager(groups: Record<string, string[]>) {
  return {
    getElementTypesInGroup: (group: string) =>
      (groups[group] ?? []).map(name => ({
        name,
        stateModel: types.model(name, {}),
      })),
  } as unknown as PluginManager
}

const pluginManager = fakePluginManager({
  widget: ['HierarchicalTrackSelectorWidget'],
  view: ['LinearGenomeView', 'BreakpointSplitView'],
  track: ['FeatureTrack'],
  display: ['LinearBasicDisplay'],
})

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
