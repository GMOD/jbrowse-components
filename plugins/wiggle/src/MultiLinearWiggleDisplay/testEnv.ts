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
import { types } from '@jbrowse/mobx-state-tree'
import {
  BaseLinearDisplayComponent,
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import configSchema from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { WiggleDataResult, WiggleSourceData } from '../util.ts'
import type { MultiLinearWiggleDisplayModel } from './model.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

// A minimal but fully-typed zero-feature source: enough to populate
// `sourcesVolatile` (which is what unblocks clustering and the row-count menu
// gates), with no features to render.
export function makeSource(name: string): WiggleSourceData {
  return {
    name,
    featurePositions: new Uint32Array(0),
    featureScores: new Float32Array(0),
    featureMinScores: new Float32Array(0),
    featureMaxScores: new Float32Array(0),
    numFeatures: 0,
    hasSummaryScores: false,
    posFeaturePositions: new Uint32Array(0),
    posFeatureScores: new Float32Array(0),
    posNumFeatures: 0,
    negFeaturePositions: new Uint32Array(0),
    negFeatureScores: new Float32Array(0),
    negNumFeatures: 0,
  }
}

// RenderMultiWiggleData is batched — one call for every visible region — so the
// result is an array with one entry per requested region.
export function makeMultiWiggleData(...names: string[]): WiggleDataResult[] {
  return [{ sources: names.map(makeSource) }]
}

// Shared display-instantiation harness: builds a PluginManager with a
// MultiQuantitativeTrack + MultiLinearWiggleDisplay and a minimal
// session/assemblyManager so a real display model can be created and driven in
// unit tests. createDisplay accepts extra display-snapshot props so tests can
// seed persistent state (e.g. runClustering) declaratively, exactly as the app
// does via addView.
export function createTestEnvironment() {
  console.warn = jest.fn()
  console.error = jest.fn()
  const pluginManager = new PluginManager()

  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BedTabixAdapter',
        configSchema: ConfigurationSchema(
          'BedTabixAdapter',
          {},
          { explicitlyTyped: true },
        ),
        getAdapterClass: () => Promise.resolve(class extends BaseAdapter {}),
      }),
  )

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'MultiQuantitativeTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'MultiQuantitativeTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'MultiQuantitativeTrack',
        trackConfigSchema,
      ),
    })
  })

  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'MultiLinearWiggleDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'MultiQuantitativeTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const mockRpcCall = jest.fn()

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)

  const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
  const trackConfig = trackConfigSchema.create(
    {
      type: 'MultiQuantitativeTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      adapter: { type: 'BedTabixAdapter' },
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
      // what queueDialog was called with, resolved to [Component, props] so a
      // test can assert on the props a menu item passes its dialog
      queuedDialogs: [] as [unknown, Record<string, unknown>][],
      rpcManager: {
        call: mockRpcCall,
      },
      assemblyManager: {
        get: (name: string) =>
          name === 'volvox'
            ? {
                initialized: true,
                regions: [
                  {
                    refName: 'ctgA',
                    start: 0,
                    end: 50_000,
                    assemblyName: 'volvox',
                  },
                ],
                getCanonicalRefName: (refName: string) => refName,
                configuration: { sequence: undefined },
              }
            : undefined,
        isValidRefName: () => true,
      },
    }))
    .views(() => ({
      getTrackById(id: string) {
        return id === 'test_track' ? trackConfig : undefined
      },
    }))
    .actions(self => ({
      setView(view: Instance<typeof LinearGenomeModel>) {
        self.view = view
        return view
      },
      notifyError() {},
      queueDialog(
        cb: (handleClose: () => void) => [unknown, Record<string, unknown>],
      ) {
        self.queuedDialogs.push(cb(() => {}))
      },
    }))

  function createDisplay(displaySnapshot?: Record<string, unknown>) {
    const session = Session.create({ configuration: {} }, { pluginManager })
    const view = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'MultiQuantitativeTrack',
            configuration: 'test_track',
            displays: [
              { type: 'MultiLinearWiggleDisplay', ...displaySnapshot },
            ],
          },
        ],
      }),
    )
    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
    ])

    const track = view.tracks[0]!
    const display: MultiLinearWiggleDisplayModel = track.displays[0]
    return { session, view, track, display, mockRpcCall }
  }

  return { createDisplay, mockRpcCall }
}
