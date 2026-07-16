import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { types } from '@jbrowse/mobx-state-tree'
import {
  BaseLinearDisplayComponent,
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Headless harness for the alignments display; same shape as
// derivedRegionTooLarge.test.ts, which this complements.
function createTestEnvironment() {
  console.warn = jest.fn()
  console.error = jest.fn()
  const pluginManager = new PluginManager()
  const configSchema = configSchemaFactory(pluginManager)

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'AlignmentsTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'AlignmentsTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'AlignmentsTrack',
        trackConfigSchema,
      ),
    })
  })

  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LinearAlignmentsDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'AlignmentsTrack',
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
      type: 'AlignmentsTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
    },
    { pluginManager },
  )

  const asm = {
    initialized: true,
    regions: [
      { refName: 'ctgA', start: 0, end: 10_000_000, assemblyName: 'volvox' },
    ],
    getCanonicalRefName: (refName: string) => refName,
    getGeneticCodeId: () => undefined,
    configuration: { sequence: undefined },
  }

  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
    .volatile(() => ({
      rpcManager: { call: mockRpcCall },
      theme: createJBrowseTheme(),
      assemblyManager: {
        get: (name: string) => (name === 'volvox' ? asm : undefined),
        waitForAssembly: () => Promise.resolve(asm),
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
      notify() {},
      notifyError() {},
      queueDialog() {},
    }))

  function createDisplay() {
    const session = Session.create({ configuration: {} }, { pluginManager })
    const view = session.setView(
      LinearGenomeModel.create({
        type: 'LinearGenomeView',
        tracks: [
          {
            type: 'AlignmentsTrack',
            configuration: 'test_track',
            displays: [{ type: 'LinearAlignmentsDisplay' }],
          },
        ],
      }),
    )
    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000_000, refName: 'ctgA' },
    ])
    const display = view.tracks[0]!.displays[0]!
    return { session, view, display, mockRpcCall }
  }

  return { createDisplay, mockRpcCall }
}

// Mark every buffered region loaded and the canvas painted — the state the
// display reaches after a successful fetch.
function simulateLoaded(
  view: ReturnType<ReturnType<typeof createTestEnvironment>['createDisplay']>['view'],
  display: ReturnType<
    ReturnType<typeof createTestEnvironment>['createDisplay']
  >['display'],
) {
  for (const b of view.bufferedVisibleRegions) {
    display.setLoadedRegion(b.displayedRegionIndex, b.region)
  }
  display.markCanvasDrawn()
}

// Worker output is absolute genomic uint32, so alignment data stays valid under
// zoom and alignments leaves `isCacheValid` at the default `() => true` — see
// ARCHITECTURE.md "Per-region zoom-staleness". These pin the consequence: a zoom
// that stays inside the fetched buffer must not drop into the loading phase.
// BreakpointSplitView's overlays depend on it — a cleared `rpcDataMap` makes
// every `searchFeatureByID` miss, which is what collapses its connection curves
// onto the track's bottom edge.
describe('alignments zoom does not invalidate loaded data', () => {
  it('stays ready through a small zoom in', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(5)
    view.scrollTo(1000)
    simulateLoaded(view, display)
    expect(display.displayPhase).toBe('ready')

    view.zoomTo(4.5)

    expect(display.loadedRegions.size).toBe(1)
    expect(display.viewportWithinLoadedData).toBe(true)
    expect(display.displayPhase).toBe('ready')
  })

  it('stays ready through a zoom out that stays inside the buffer', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(5)
    view.scrollTo(1000)
    simulateLoaded(view, display)

    view.zoomTo(6)

    expect(display.viewportWithinLoadedData).toBe(true)
    expect(display.displayPhase).toBe('ready')
  })

  it('goes loading once a zoom out leaves the buffer, but keeps the data', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(5)
    view.scrollTo(1000)
    simulateLoaded(view, display)

    view.zoomTo(20)

    // The overlay curves must survive this: the viewport is stale but the
    // pileup data isn't cleared, so reads are still locatable by id.
    expect(display.viewportWithinLoadedData).toBe(false)
    expect(display.displayPhase).toBe('loading')
    expect(display.loadedRegions.size).toBe(1)
  })
})
