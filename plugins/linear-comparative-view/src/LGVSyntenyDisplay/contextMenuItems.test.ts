import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { SimpleFeature } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import {
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import configSchemaF from './configSchemaF.ts'
import stateModelF from './model.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// A real LGVSyntenyDisplay on a two-assembly SyntenyTrack: the menu reads the
// track config (for the mate-assembly check) and the containing view, so a mock
// self would just reimplement the thing under test.
function createDisplay() {
  console.warn = jest.fn()
  const pluginManager = new PluginManager()
  const configSchema = configSchemaF(pluginManager)

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'SyntenyTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'SyntenyTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'SyntenyTrack',
        trackConfigSchema,
      ),
    })
  })

  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LGVSyntenyDisplay',
        configSchema,
        stateModel: stateModelF(configSchema),
        trackType: 'SyntenyTrack',
        viewType: 'LinearGenomeView',
        // never rendered here; this harness exercises the model
        ReactComponent: () => null,
      }),
  )

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)
  const trackConfig = pluginManager.pluggableConfigSchemaType('track').create(
    {
      type: 'SyntenyTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox', 'volvox_random'],
    },
    { pluginManager },
  )

  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
    .volatile(() => ({
      rpcManager: {},
      theme: createJBrowseTheme(),
      // giving the view a displayed region wakes the assembly-readiness
      // reactions, which want an assemblyManager to ask
      assemblyManager: {
        get: (name: string) =>
          name === 'volvox' ? { initialized: true } : undefined,
      },
    }))
    .views(() => ({
      getTrackById(id: string) {
        return id === 'test_track' ? trackConfig : undefined
      },
      // every promotable-slot read walks the cascade through this; nothing is
      // promoted in these tests, so every display resolves to its promotedBase
      getDisplayTypeDefault() {
        return undefined
      },
    }))
    .actions(self => ({
      setView(view: Instance<typeof LinearGenomeModel>) {
        self.view = view
        return view
      },
    }))

  const session = Session.create({ configuration: {} }, { pluginManager })
  const view = session.setView(
    LinearGenomeModel.create({
      type: 'LinearGenomeView',
      tracks: [
        {
          type: 'SyntenyTrack',
          configuration: 'test_track',
          displays: [{ type: 'LGVSyntenyDisplay' }],
        },
      ],
    }),
  )
  view.setWidth(800)
  // The launch item anchors its first panel on the view's own assembly, so the
  // view needs a region to name one.
  view.setDisplayedRegions([
    { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volvox' },
  ])
  return view.tracks[0]!.displays[0]!
}

function labels(display: ReturnType<typeof createDisplay>) {
  return display
    .contextMenuItems()
    .map((i: unknown) => (i as { label?: string }).label)
}

function makeFeature(mateAssembly: string) {
  return new SimpleFeature({
    uniqueId: 'f1',
    refName: 'ctgA',
    start: 0,
    end: 100,
    mate: { refName: 'ctgB', start: 0, end: 100, assemblyName: mateAssembly },
  })
}

// The whole point of building these from the id: the feature behind a
// right-clicked PAF block arrives an RPC later (a whole-block re-read, before
// the lookup was narrowed), and gating the items on it opened a menu with
// nothing in it.
test('the block items are there before the feature fetch lands', () => {
  const display = createDisplay()
  display.openContextMenu({ coord: [1, 2], featureId: 'f1' })
  expect(display.contextMenuFeature).toBeUndefined()
  expect(labels(display)).toEqual([
    'Open feature details',
    'Copy info to clipboard',
  ])
})

// The exception, and why it goes last: whether a synteny view can open is a
// per-feature question (the mate's assembly), so it can only appear once the
// feature lands — appending, rather than inserting above items the cursor is
// already over.
test('a launchable mate appends the synteny item when the feature lands', () => {
  const display = createDisplay()
  display.openContextMenu({ coord: [1, 2], featureId: 'f1' })
  display.setContextMenuFeature(makeFeature('volvox_random'))
  expect(labels(display)).toEqual([
    'Open feature details',
    'Copy info to clipboard',
    'Launch synteny view for this position',
  ])
})

// A one-vs-all mate can be a PanSN sample that is no declared assembly of the
// track; offering a view that fails to open would be worse than not offering it.
test('a mate outside the track assemblies gets no synteny item', () => {
  const display = createDisplay()
  display.openContextMenu({ coord: [1, 2], featureId: 'f1' })
  display.setContextMenuFeature(makeFeature('HG002#1'))
  expect(labels(display)).toEqual([
    'Open feature details',
    'Copy info to clipboard',
  ])
})

test('a right-click on no feature offers no feature items', () => {
  const display = createDisplay()
  display.openContextMenu({ coord: [1, 2] })
  expect(labels(display)).toEqual([])
})
