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
  BaseLinearDisplayComponent,
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import configSchemaF from './configSchema.ts'
import stateModelFactory from './stateModel.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Headless harness for the MAF display: registers a MafTrack + LinearMafDisplay
// and a minimal session/assemblyManager so the real state model's derived
// regionTooLarge can be exercised across zoom/pan/navigation without a worker.
// Modeled on LD's derivedRegionTooLarge.test.ts + maf's emptyRegionLoading.test.
function createTestEnvironment() {
  console.warn = jest.fn()
  console.error = jest.fn()
  // MAF's configSchema reads baseLinearDisplayConfigSchema off the installed
  // LinearGenomeViewPlugin's exports, so the real plugin must be registered.
  const pluginManager = new PluginManager([new LinearGenomeViewPlugin()])

  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'MafTabixAdapter',
        configSchema: ConfigurationSchema(
          'MafTabixAdapter',
          {},
          { explicitlyTyped: true },
        ),
        getAdapterClass: () => Promise.resolve(class extends BaseAdapter {}),
      }),
  )

  const configSchema = configSchemaF(pluginManager)

  pluginManager.addTrackType(() => {
    const trackConfigSchema = ConfigurationSchema(
      'MafTrack',
      {},
      {
        baseConfiguration: createBaseTrackConfig(pluginManager),
        explicitIdentifier: 'trackId',
      },
    )
    return new TrackType({
      name: 'MafTrack',
      configSchema: trackConfigSchema,
      stateModel: createBaseTrackModel(
        pluginManager,
        'MafTrack',
        trackConfigSchema,
      ),
    })
  })

  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LinearMafDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'MafTrack',
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
      type: 'MafTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      adapter: { type: 'MafTabixAdapter' },
    },
    { pluginManager },
  )

  const asm = {
    initialized: true,
    regions: [
      { refName: 'ctgA', start: 0, end: 10_000_000, assemblyName: 'volvox' },
    ],
    getCanonicalRefName: (refName: string) => refName,
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
            type: 'MafTrack',
            configuration: 'test_track',
            displays: [{ type: 'LinearMafDisplay' }],
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
// the current viewport. These lock in the self-releasing behavior — a banner
// that clears on zoom-in (not stuck), doesn't flicker on pan, and a force-load
// that stays cleared even after a zoom-out (the invariant that once bit LD).
describe('MAF derived regionTooLarge', () => {
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

    // half the span → scaled estimate ~750kB < 1MB cap, still above the floor:
    // clears via the derived scaling, not the AUTO_FORCE_LOAD_BP shortcut.
    view.zoomTo(50)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(false)
  })

  it('does not flicker on pan: estimate survives a viewport shift that stays too large', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setFeatureDensityStats({ bytes: 1_500_000 })
    expect(display.regionTooLarge).toBe(true)

    // pan (same zoom) keeps it too large; the estimate is not cleared
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

    // zoom out: the scaled estimate grows past the raw captured bytes, so a
    // limit raised only past the raw bytes would leave the banner up
    view.zoomTo(400)
    expect(display.regionTooLarge).toBe(true)

    display.setFeatureDensityStatsLimit(display.featureDensityStats)
    expect(display.regionTooLarge).toBe(false)
  })

  // afterAttach installs the onDisplayedRegionsChange autorun that drops the
  // cached estimate on chromosome navigation. Without it, a previous region's
  // estimate would gate the new region against the wrong stats and, because
  // FetchVisibleRegions gates on !regionTooLarge, wedge the banner permanently.
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
