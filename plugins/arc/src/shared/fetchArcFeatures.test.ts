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
    method === 'CoreGetRegionByteEstimate'
      ? { bytes: 100, fetchSizeLimit: 0, featureDensity: 1 }
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

// Arc's regionTooLarge is DERIVED (byte-only), identical to the LD pattern
// (ArcFetchModel), so it is exercised the same way: drive setByteEstimate
// synchronously — before the async afterAttach installs its autoruns — and read
// the derived getter. This is the de-specialization the migration achieved:
// there is no imperative setRegionTooLarge and no "don't early-return" hack.
describe('arc derived regionTooLarge', () => {
  it('is false with no estimate yet', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.regionTooLarge).toBe(false)
  })

  it('trips when the captured estimate exceeds the fetch cap at wide zoom', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(2000)
    display.setByteEstimate({ bytes: 1_500_000 })
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(true)
  })

  it('self-releases on zoom-in via scaling, without an imperative clear', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(2000)
    display.setByteEstimate({ bytes: 1_500_000 })
    expect(display.regionTooLarge).toBe(true)

    // scaled estimate shrinks with the span; still above AUTO_FORCE_LOAD_BP
    view.zoomTo(50)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(false)
  })

  it('does not flicker on pan: the estimate survives a viewport shift', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(2000)
    display.setByteEstimate({ bytes: 1_500_000 })
    expect(display.regionTooLarge).toBe(true)

    view.scrollTo(view.offsetPx + 200)
    expect(display.byteEstimate).toBeDefined()
    expect(display.regionTooLarge).toBe(true)
  })

  it('force-load clears the banner even after zooming out past the capture', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(2000)
    display.setByteEstimate({ bytes: 1_500_000 })
    expect(display.regionTooLarge).toBe(true)

    // zoom out: the scaled estimate grows past the raw captured bytes, so a
    // limit raised only past the raw bytes would leave the banner up
    view.zoomTo(8000)
    expect(display.regionTooLarge).toBe(true)
    display.raiseForceLoadLimits(display.byteEstimate)
    expect(display.regionTooLarge).toBe(false)
  })

  it('forceLoad config keeps the banner cleared regardless of the estimate', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(2000)
    display.setByteEstimate({ bytes: 1_500_000 })
    expect(display.regionTooLarge).toBe(true)

    // the declarative equivalent of clicking "Force load"
    display.configuration.setSlot('forceLoad', true)
    expect(display.configForceLoad).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })
})

// The fetchArcFeatures flow (density probe → commit → derived gate → feature
// download) mirrors LD's performLDFetch and is driven by the shared
// installGlobalFetchAutorun; it isn't unit-tested in isolation here because the
// direct call races the async afterAttach autoruns (which clear the estimate on
// install). Browser tests cover the end-to-end path via the arc-display-done
// testid.

// Arc's fetch trigger gates on `!dataLoaded`, which goes false the moment a
// fetch commits. That is the shape that breaks a naive reload: the skeleton
// autorun stops re-reading `reloadCounter` once it settles into "nothing to
// fetch", so bumping the counter can't wake it, and the signature still matches
// so `shouldFetch` would stay false anyway. Covers both halves of the fix —
// unconditional trigger reads in installGlobalFetchAutorun, and ArcFetchModel's
// reload() dropping loadedRegionSignature.
describe('arc reload', () => {
  it('refetches after a successful load', async () => {
    const { display, view, mockRpcCall } = createTestEnvironment().createDisplay()
    // zoom in under the byte cap so the first fetch actually commits
    view.zoomTo(50)
    await settle()

    const featureFetches = () =>
      mockRpcCall.mock.calls.filter(c => c[1] === 'CoreGetFeatures').length
    expect(display.dataLoaded).toBe(true)
    expect(featureFetches()).toBe(1)

    display.reload()
    await settle()
    expect(featureFetches()).toBe(2)
  })
})

// the fetch autorun is debounced 1s, so give it room past that
async function settle() {
  for (let i = 0; i < 80; i++) {
    await new Promise(resolve => setTimeout(resolve, 20))
  }
}
