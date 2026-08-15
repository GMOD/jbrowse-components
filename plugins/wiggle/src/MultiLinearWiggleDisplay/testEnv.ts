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
import {
  displayTestSessionModel,
  testAssembly,
  testAssemblyManager,
} from '@jbrowse/display-test-utils'
import { linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory } from '@jbrowse/plugin-linear-genome-view'

import configSchema from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { MultiLinearWiggleDisplayModel } from './model.ts'
import type { WiggleDataResult, WiggleSourceData } from '@jbrowse/wiggle-core'

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
  // `console.warn` only — `console.error` is the display-contract channel
  // (TEST_INFRASTRUCTURE.md).
  console.warn = jest.fn()
  const pluginManager = new PluginManager()

  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MultiWiggleAdapter',
        configSchema: ConfigurationSchema(
          'MultiWiggleAdapter',
          {},
          { explicitlyTyped: true },
        ),
        // as the real MultiWiggleAdapter declares — it's what surfaces the
        // Resolution and Summary score mode track-menu entries
        adapterCapabilities: ['hasResolution'],
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
      // never rendered here; this harness exercises the model
      ReactComponent: () => null,
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
      adapter: { type: 'MultiWiggleAdapter' },
    },
    { pluginManager },
  )

  const Session = displayTestSessionModel({
    viewModel: LinearGenomeModel,
    rpcManager: { call: mockRpcCall },
    assemblyManager: testAssemblyManager(testAssembly()),
    getTrackById: (id: string) =>
      id === 'test_track' ? trackConfig : undefined,
  })

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
