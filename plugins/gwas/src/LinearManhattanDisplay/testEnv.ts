import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { types } from '@jbrowse/mobx-state-tree'
import LinearGenomeViewPlugin, {
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import { configSchemaFactory } from './configSchemaFactory.ts'
import { stateModelFactory } from './stateModelFactory.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Headless harness for the real LinearManhattanDisplay inside a real
// LinearGenomeView, with a stub session and a `jest.fn()` rpcManager — no worker
// and no DOM. One per display rather than a copy per test file, the same way the
// wiggle and multi-row displays do it.
//
// Two displayed regions, because the behaviours worth testing here are about
// what happens across a multi-region load (the LD auto-index has to survive a
// partially-arrived batch).
export function createTestEnvironment() {
  // `console.warn` only. `console.error` is the channel the dev-only
  // display-contract checks report through (assertDisplayContract,
  // makeRetryContractCheck), so silencing it here would mute the one
  // signal these harnesses exist to be able to produce. It was silenced
  // by copied boilerplate and was hiding nothing: with it removed the
  // seven display plugins run 3344 tests with no console.error at all.
  console.warn = jest.fn()
  const pluginManager = new PluginManager([new LinearGenomeViewPlugin()])

  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'GWASAdapter',
        configSchema: ConfigurationSchema(
          'GWASAdapter',
          { ldAdapter: { type: 'frozen', defaultValue: null } },
          { explicitlyTyped: true },
        ),
        getAdapterClass: () => Promise.resolve(class extends BaseAdapter {}),
      }),
  )

  const configSchema = configSchemaFactory()

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'GWASTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'GWASTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'GWASTrack',
        trackConfigSchema,
      ),
    })
  })

  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearManhattanDisplay',
        configSchema,
        stateModel: stateModelFactory(pluginManager, configSchema),
        trackType: 'GWASTrack',
        viewType: 'LinearGenomeView',
        // never rendered here; this harness exercises the model
        ReactComponent: () => null,
      }),
  )

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const mockRpcCall = jest.fn()
  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)

  const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
  const trackConfig = trackConfigSchema.create(
    {
      type: 'GWASTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      adapter: {
        type: 'GWASAdapter',
        ldAdapter: { type: 'PlinkLDAdapter', uri: 'https://example.com/x.ld' },
      },
    },
    { pluginManager },
  )

  const regions = ['ctgA', 'ctgB'].map(refName => ({
    refName,
    start: 0,
    end: 10_000,
    assemblyName: 'volvox',
  }))

  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
      // same shape as BaseSession's preferencesOverrides.displayTypeDefaults
      displayTypeDefaults: types.frozen<
        Record<string, Record<string, unknown>>
      >({}),
    })
    .volatile(() => ({
      rpcManager: { call: mockRpcCall },
      theme: createJBrowseTheme(),
      assemblyManager: {
        get: (name: string) =>
          name === 'volvox'
            ? {
                initialized: true,
                regions,
                getCanonicalRefName: (refName: string) => refName,
                configuration: { sequence: undefined },
              }
            : undefined,
        isValidRefName: () => true,
      },
    }))
    .views(self => ({
      getTrackById(id: string) {
        return id === 'test_track' ? trackConfig : undefined
      },
      // Every promotable-slot read walks the cascade through this. Backed by
      // the same nested displayType -> slot -> value shape BaseSession uses, so
      // a test can promote a default and watch a display pick it up; with
      // nothing promoted (the usual case) every display resolves to its
      // promotedBase, which is what this returned unconditionally before
      // `showLdLegend` gave the harness a second promotable slot worth driving.
      getDisplayTypeDefault(displayType: string, slot: string): unknown {
        return self.displayTypeDefaults[displayType]?.[slot]
      },
    }))
    .actions(self => ({
      setView(view: Instance<typeof LinearGenomeModel>) {
        self.view = view
        return view
      },
      notifyError() {},
      // the promotable pin reports through this ("Set as the default")
      notify(_message: string, _level?: string) {},
      queueDialog() {},
      // reassigned wholesale so the display getters track it reactively
      setDisplayTypeDefault(displayType: string, slot: string, value: unknown) {
        const forType = { ...self.displayTypeDefaults[displayType] }
        if (value === undefined) {
          delete forType[slot]
        } else {
          forType[slot] = value
        }
        self.displayTypeDefaults = {
          ...self.displayTypeDefaults,
          [displayType]: forType,
        }
      },
    }))

  function createDisplay({
    colorBy = 'normal',
  }: { colorBy?: 'normal' | 'ld' } = {}) {
    const session = Session.create({ configuration: {} }, { pluginManager })
    const view = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'GWASTrack',
            configuration: 'test_track',
            displays: [{ type: 'LinearManhattanDisplay' }],
          },
        ],
      }),
    )
    view.setWidth(800)
    view.setDisplayedRegions(regions)
    view.showAllRegions()
    const display = view.tracks[0]!.displays[0]!
    if (colorBy !== 'normal') {
      // colorBy is a config slot, so it has to be written through the action
      // rather than passed in the display snapshot
      display.setColorBy(colorBy)
    }
    return { session, view, display }
  }

  return { createDisplay, mockRpcCall }
}
