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

import sharedLDConfigFactory from './SharedLDConfigSchema.ts'
import sharedModelFactory from './shared.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Headless harness for the LD display: registers a VariantTrack + LDDisplay and
// a minimal session/assemblyManager so the real state model can be created and
// its derived regionTooLarge exercised across zoom/pan/navigation without a
// worker. Modeled on canvas's LinearBasicDisplay/testEnv.ts.
function createTestEnvironment() {
  console.warn = jest.fn()
  console.error = jest.fn()
  const pluginManager = new PluginManager()

  const configSchema = ConfigurationSchema(
    'LDDisplay',
    { height: { type: 'number', defaultValue: 400 } },
    { baseConfiguration: sharedLDConfigFactory(), explicitlyTyped: true },
  )

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
      name: 'LDDisplay',
      configSchema,
      stateModel: sharedModelFactory(configSchema)
        .named('LDDisplay')
        .props({ type: types.literal('LDDisplay') }),
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
            displays: [{ type: 'LDDisplay' }],
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
// the current viewport. These lock in the behavior the imperative path got
// wrong — a banner that stuck on zoom-in (the reported bug), and that would
// flicker on pan.
describe('LD derived regionTooLarge', () => {
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

  // afterAttach installs the onDisplayedRegionsChange autorun that drops the
  // cached estimate on chromosome navigation. Without it, a previous region's
  // estimate would gate the new region against the wrong stats and, because the
  // fetch autorun gates on !regionTooLarge, wedge the banner permanently.
  it('clears the cached estimate on region navigation so it cannot wedge', async () => {
    const { display, view } = createTestEnvironment().createDisplay()
    // let afterAttach's dynamic import resolve and install its autoruns
    await new Promise(res => setTimeout(res, 0))

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
