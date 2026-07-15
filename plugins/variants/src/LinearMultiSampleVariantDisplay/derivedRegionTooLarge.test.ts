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

import configSchemaFactory from './configSchema.ts'
import { stateModelFactory } from './model.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Headless harness for the multi-sample variant display: registers a
// VariantTrack + LinearMultiSampleVariantDisplay so the real state model's
// derived regionTooLarge can be exercised across zoom/pan/navigation without a
// worker. Modeled on LD's derivedRegionTooLarge.test.ts.
function createTestEnvironment() {
  console.warn = jest.fn()
  console.error = jest.fn()
  const pluginManager = new PluginManager()

  const configSchema = configSchemaFactory()

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'VariantTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'VariantTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'VariantTrack',
        trackConfigSchema,
      ),
    })
  })

  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LinearMultiSampleVariantDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: () => null,
    })
  })

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const mockRpcCall = jest.fn()
  const LinearGenomeModel = linearGenomeViewStateModelFactory(pluginManager)
  const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
  const trackConfig = trackConfigSchema.create(
    {
      type: 'VariantTrack',
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
            type: 'VariantTrack',
            configuration: 'test_track',
            displays: [{ type: 'LinearMultiSampleVariantDisplay' }],
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

// Derived regionTooLarge: a pure function of the cached byte estimate scaled to
// the current viewport — self-releases on zoom-in, no flicker on pan, force-load
// stays cleared after a zoom-out, estimate cleared on chromosome nav. Same suite
// LD/maf use, driving the shared RegionTooLargeMixin derived gate.
describe('MultiSampleVariant derived regionTooLarge', () => {
  it('is false with no estimate yet', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.regionTooLarge).toBe(false)
  })

  it('trips when the captured estimate exceeds the fetch cap at wide zoom', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100) // visibleBp ≈ 80_000 > AUTO_FORCE_LOAD_BP
    display.setFeatureDensityStats({ bytes: 1_500_000 })
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(true)
  })

  it('self-releases on zoom-in via scaling, without an imperative clear', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setFeatureDensityStats({ bytes: 1_500_000 })
    expect(display.regionTooLarge).toBe(true)

    view.zoomTo(50)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(false)
  })

  it('does not flicker on pan: estimate survives a viewport shift that stays too large', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setFeatureDensityStats({ bytes: 1_500_000 })
    expect(display.regionTooLarge).toBe(true)

    view.scrollTo(view.offsetPx + 200)
    expect(display.featureDensityStats).toBeDefined()
    expect(display.regionTooLarge).toBe(true)
  })

  it('force-load raises the limit and clears the banner', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setFeatureDensityStats({ bytes: 1_500_000 })
    expect(display.regionTooLarge).toBe(true)

    display.setFeatureDensityStatsLimit(display.featureDensityStats)
    expect(display.regionTooLarge).toBe(false)
  })

  it('force-load clears the banner even after zooming out past the capture', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setFeatureDensityStats({ bytes: 1_500_000 })
    expect(display.regionTooLarge).toBe(true)

    view.zoomTo(400)
    expect(display.regionTooLarge).toBe(true)

    display.setFeatureDensityStatsLimit(display.featureDensityStats)
    expect(display.regionTooLarge).toBe(false)
  })

  it('clears the cached estimate on region navigation so it cannot wedge', () => {
    const { display, view } = createTestEnvironment().createDisplay()

    view.zoomTo(100)
    display.setFeatureDensityStats({ bytes: 1_500_000 })
    expect(display.regionTooLarge).toBe(true)

    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 8_000_000, refName: 'ctgA' },
    ])
    expect(display.featureDensityStats).toBeUndefined()
    expect(display.regionTooLarge).toBe(false)
  })
})
