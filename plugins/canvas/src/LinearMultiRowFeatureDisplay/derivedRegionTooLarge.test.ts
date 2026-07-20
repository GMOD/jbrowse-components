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
import stateModelFactory from './model.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Headless harness for the multi-row display, modeled on maf/LD's
// derivedRegionTooLarge harness. Exercises the CanvasFeatureGateMixin gate (byte
// + density) through the real state model without a worker: drive
// setFeatureDensityStats / setDensityStats and read the derived regionTooLarge.
function createTestEnvironment(opts?: { adapterFetchSizeLimit?: number }) {
  console.warn = jest.fn()
  console.error = jest.fn()
  const pluginManager = new PluginManager([new LinearGenomeViewPlugin()])

  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'TestFeatureAdapter',
        configSchema: ConfigurationSchema(
          'TestFeatureAdapter',
          { fetchSizeLimit: { type: 'number', defaultValue: 0 } },
          { explicitlyTyped: true },
        ),
        getAdapterClass: () => Promise.resolve(class extends BaseAdapter {}),
      }),
  )

  const configSchema = configSchemaF(pluginManager)

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

  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearMultiRowFeatureDisplay',
        configSchema,
        stateModel: stateModelFactory(configSchema),
        trackType: 'FeatureTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      }),
  )

  pluginManager.createPluggableElements()
  pluginManager.configure()

  const mockRpcCall = jest.fn()
  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)
  const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
  const trackConfig = trackConfigSchema.create(
    {
      type: 'FeatureTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      adapter: {
        type: 'TestFeatureAdapter',
        fetchSizeLimit: opts?.adapterFetchSizeLimit ?? 0,
      },
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
            type: 'FeatureTrack',
            configuration: 'test_track',
            displays: [{ type: 'LinearMultiRowFeatureDisplay' }],
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

describe('multi-row derived regionTooLarge (byte axis)', () => {
  it('is false with no estimate yet', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.regionTooLarge).toBe(false)
  })

  it('trips when the captured byte estimate exceeds the fetch cap at wide zoom', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100) // visibleBp > AUTO_FORCE_LOAD_BP
    display.setFeatureDensityStats({ bytes: 8_000_000 }) // over the 5MB config
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(true)
  })

  it('self-releases on zoom-in via scaling, without an imperative clear', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setFeatureDensityStats({ bytes: 8_000_000 })
    expect(display.regionTooLarge).toBe(true)

    view.zoomTo(20)
    expect(display.regionTooLarge).toBe(false)
  })

  it('honors an adapter-declared fetchSizeLimit over the display config', () => {
    const { display, view } = createTestEnvironment({
      adapterFetchSizeLimit: 50_000_000,
    }).createDisplay()
    view.zoomTo(100)
    // 8MB is over the 5MB display config but under the 50MB adapter limit
    display.setFeatureDensityStats({
      bytes: 8_000_000,
      fetchSizeLimit: 50_000_000,
    })
    expect(display.byteSizeLimit()).toBe(50_000_000)
    expect(display.regionTooLarge).toBe(false)
  })

  it('force-load raises the limit and clears the banner', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setFeatureDensityStats({ bytes: 8_000_000 })
    expect(display.regionTooLarge).toBe(true)

    display.forceLoad()
    expect(display.userByteSizeLimit).toBeDefined()
    expect(display.regionTooLarge).toBe(false)
  })

  it('forceLoad config keeps the banner cleared regardless of the estimate', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setFeatureDensityStats({ bytes: 8_000_000 })
    expect(display.regionTooLarge).toBe(true)

    display.configuration.setSlot('forceLoad', true)
    expect(display.configForceLoad).toBe(true)
    expect(display.regionTooLarge).toBe(false)
    // and the worker gate goes unlimited so the forced fetch isn't re-blocked
    expect(display.byteSizeLimit()).toBeUndefined()
  })

  it('clears the cached estimate on region navigation', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setFeatureDensityStats({ bytes: 8_000_000 })
    expect(display.regionTooLarge).toBe(true)

    display.clearFeatureGateStats()
    expect(display.featureDensityStats).toBeUndefined()
    expect(display.regionTooLarge).toBe(false)
  })
})

describe('multi-row derived regionTooLarge (density axis)', () => {
  // Density is a live max over visible regions at coarseBpPerPx, so settle the
  // debounced coarse blocks the gate reads after each zoom.
  function settle(view: { dynamicBlocks: unknown; bpPerPx: number }) {
    ;(
      view as unknown as {
        setCoarseDynamicBlocks: (b: unknown, bp: number) => void
      }
    ).setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
  }

  // Multi-row disables the density axis (densityGateDisabled): it paints features
  // into fixed lanes, so a high total feature count is not a per-glyph render
  // cost — only the byte/download budget gates it. The "Too many features"
  // banner must never show here regardless of density.
  it('never trips on density even at an extreme feature count', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    settle(view)
    // a dense region that would trip the default maxFeatureScreenDensity of 1
    display.setDensityStats(0, {
      featureCount: 500_000,
      regionWidthBp: 10_000_000,
    })
    expect(display.maxFeatureDensity).toBeUndefined()
    expect(display.densityTooLarge).toBe(false)
    expect(display.regionTooLarge).toBe(false)
  })
})
