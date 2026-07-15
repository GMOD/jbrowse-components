import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'
import { linearGenomeViewStateModelFactory } from '@jbrowse/plugin-linear-genome-view'
import { autorun } from 'mobx'

import { fetchArcFeatures } from './fetchArcFeatures.ts'
import { configSchemaFactory } from '../LinearArcDisplay/configSchema.ts'
import { stateModelFactory } from '../LinearArcDisplay/model.ts'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

// Headless harness for LinearArcDisplay: registers a FeatureTrack + arc display
// and a minimal session/assemblyManager so the real state model can be created
// and its region-too-large fetch gating exercised across zoom without a worker.
// Modeled on the LD display's derivedRegionTooLarge test harness.
function createTestEnvironment() {
  console.warn = jest.fn()
  console.error = jest.fn()
  const pluginManager = new PluginManager()

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'FeatureTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'FeatureTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'FeatureTrack',
        trackConfigSchema,
      ),
    })
  })

  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearArcDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: () => null,
    })
  })

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const mockRpcCall = jest.fn(async (_sessionId: string, method: string) =>
    method === 'CoreGetFeatureDensityStats'
      ? { bytes: 1_500_000, fetchSizeLimit: 0, featureDensity: 1 }
      : [],
  )
  const LinearGenomeModel = linearGenomeViewStateModelFactory(pluginManager)
  const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
  const trackConfig = trackConfigSchema.create(
    {
      type: 'FeatureTrack',
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
            type: 'FeatureTrack',
            configuration: 'test_track',
            displays: [{ type: 'LinearArcDisplay' }],
          },
        ],
      }),
    )
    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000_000, refName: 'ctgA' },
    ])
    // wide zoom: visibleBp (≈1.6 Mb) is well past AUTO_FORCE_LOAD_BP so the byte
    // gate actually engages (below the floor every region auto-loads)
    view.zoomTo(2000)
    const display = view.tracks[0]!.displays[0]! as ArcDisplayModel
    return { session, view, display, mockRpcCall }
  }

  return { createDisplay }
}

const tick = () => new Promise(res => setTimeout(res, 0))

describe('fetchArcFeatures region-too-large gating', () => {
  it('flags a too-large region and skips the feature download', async () => {
    const { display } = createTestEnvironment().createDisplay()
    await fetchArcFeatures(display)
    expect(display.regionTooLarge).toBe(true)
    // only the density estimate ran, not CoreGetFeatures
    expect(display.features).toBeUndefined()
  })

  it('re-estimates on every viewport change while too-large (does not wedge)', async () => {
    const { display, view } = createTestEnvironment().createDisplay()

    // Drive fetchArcFeatures through a real reaction — its own tracked
    // dependency set is what the fix repairs (production wraps this same call
    // in a { delay: 1000 } autorun via doAfterAttach; the tracked reads are
    // identical). Regression guard: gating on `regionTooLarge` as an
    // early-return dropped the viewport read from the tracked set once the
    // banner showed, so a second viewport change never re-fired and the banner
    // wedged until force-load.
    let runs = 0
    const dispose = autorun(() => {
      runs++
      void fetchArcFeatures(display)
    })

    await tick()
    expect(display.regionTooLarge).toBe(true)

    view.zoomTo(1000)
    const afterFirstZoom = runs
    await tick()

    // a SECOND viewport change must still re-fire: proves run #2 kept tracking
    // the viewport even though regionTooLarge was set
    view.zoomTo(500)
    expect(runs).toBe(afterFirstZoom + 1)

    dispose()
  })

  it('self-releases when a zoomed-in region fits under the limit', async () => {
    const { display, view, mockRpcCall } = createTestEnvironment().createDisplay()
    await fetchArcFeatures(display)
    expect(display.regionTooLarge).toBe(true)

    // smaller region now estimates under the fetch cap
    mockRpcCall.mockImplementation(async (_sessionId: string, method: string) =>
      method === 'CoreGetFeatureDensityStats'
        ? { bytes: 10, fetchSizeLimit: 0, featureDensity: 1 }
        : [],
    )
    view.zoomTo(300)
    await fetchArcFeatures(display)
    expect(display.regionTooLarge).toBe(false)
  })
})
