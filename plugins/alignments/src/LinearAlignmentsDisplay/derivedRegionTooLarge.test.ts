import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { types } from '@jbrowse/mobx-state-tree'
import { getMembers } from '@jbrowse/mobx-state-tree'
import { linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory } from '@jbrowse/plugin-linear-genome-view'

import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Headless harness for the alignments display: registers an AlignmentsTrack +
// LinearAlignmentsDisplay and a minimal session/assemblyManager so the real
// state model's derived regionTooLarge can be exercised without a worker.
// Modeled on maf/MSV's derivedRegionTooLarge.test.ts.
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
      palette: resolvePalette(),
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
      // every promotable-slot read walks the cascade through this; nothing is
      // promoted in these tests, so every display resolves to its promotedBase
      getDisplayTypeDefault() {
        return undefined
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

// Derived regionTooLarge: a pure function of the cached byte estimate scaled to
// the current viewport, driving the shared RegionTooLargeMixin gate — the same
// suite maf/LD/MSV use, plus alignments' onRegionTooLarge hover-clear.
// The method-shaped reactive hooks must stay in `.views()`: as actions MobX runs
// them untracked and callers keep a stale answer (BaseLinearDisplay/CLAUDE.md,
// "`isCacheValid` is a view, not an action").
test('the reactive method hooks are views, not actions', () => {
  const { display } = createTestEnvironment().createDisplay()
  const { actions } = getMembers(display)
  expect(actions).not.toContain('isCacheValid')
  expect(actions).not.toContain('rpcProps')
})

describe('alignments derived regionTooLarge', () => {
  it('is false with no estimate yet', () => {
    const { display } = createTestEnvironment().createDisplay()
    expect(display.regionTooLarge).toBe(false)
  })

  it('trips when the captured estimate exceeds the fetch cap at wide zoom', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100) // visibleBp ≈ 80_000 > AUTO_FORCE_LOAD_BP
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(true)
  })

  // The AUTO_FORCE_LOAD_BP floor lives in `gateActive` — the one place that
  // answers "may anything gate right now", shared by the verdict, the pre-flight
  // estimate RPC and canvas's worker budgets. Alignments opts out of it
  // (`gateBelowForceLoadFloor`): read cost scales with depth, so a gene-sized
  // window over a deep pileup is tens of MB, and the floor declined to look at
  // exactly that fetch.
  it('keeps gating below the AUTO_FORCE_LOAD_BP floor', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({ bytes: 1e9, measuredSpanBp: view.visibleBp })
    expect(display.regionTooLarge).toBe(true)

    // 1e9 rescaled by 1/100 is still 10 Mb, over the cap — so zooming past the
    // floor is no longer a way to download what the gate just refused.
    view.zoomTo(1)
    expect(view.visibleBp).toBeLessThan(20_000)
    expect(display.gateActive).toBe(true)
    expect(display.regionTooLarge).toBe(true)
  })

  // Below the floor the estimate stops shrinking, because the BAI stops
  // resolving span there (16kb bins) and the same bytes come down however far
  // the user zooms. So the verdict below the floor IS the verdict at 20kb —
  // which is what the opt-out's monotonicity argument already assumed, and what
  // the banner already says by dropping "zoom in to see features" down here.
  it('stops releasing on zoom below the floor, where the bytes stop falling', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({ bytes: 1e9, measuredSpanBp: view.visibleBp })

    // 1e9 floored at 20kb over an 80kb measurement is 250 Mb: still far over the
    // cap, and zooming further cannot lower it
    view.zoomTo(0.01)
    expect(view.visibleBp).toBeLessThan(20_000)
    expect(display.gateActive).toBe(true)
    expect(display.zoomCanReleaseGate).toBe(false)
    expect(display.regionTooLarge).toBe(true)

    // it is flat, not merely still-too-large: two very different zooms below the
    // floor quote the identical number, so there is no aborted fetch cycle to
    // flash the banner between them
    const deep = display.estimatedBytesForVisibleSpan
    view.zoomTo(1)
    expect(view.visibleBp).toBeLessThan(20_000)
    expect(display.estimatedBytesForVisibleSpan).toBe(deep)

    // and force-load is the way out the banner offers
    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
  })


  // Ordinary depth is nowhere near the cap at gene zoom, which is what makes the
  // opt-out safe without a coverage threshold. Measured for reference: the
  // BAI-derived estimate is flat below the index's 16kb minimum bin, so the cap
  // bites at roughly 5 Mb / 16 kb ≈ 300 bytes per reference base.
  it('leaves an ordinary pileup alone below the floor', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(1)
    expect(view.visibleBp).toBeLessThan(20_000)
    display.setByteEstimate({ bytes: 300_000, measuredSpanBp: view.visibleBp })
    expect(display.gateActive).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('self-releases on zoom-in via scaling, without an imperative clear', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    view.zoomTo(50)
    expect(view.visibleBp).toBeGreaterThan(20_000)
    expect(display.regionTooLarge).toBe(false)
  })

  it('does not flicker on pan: estimate survives a viewport shift that stays too large', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    view.scrollTo(view.offsetPx + 200)
    expect(display.byteEstimate).toBeDefined()
    expect(display.regionTooLarge).toBe(true)
  })

  it('force-load raises the limit and clears the banner', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('forceLoad config keeps the banner cleared regardless of the estimate', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    // the declarative equivalent of clicking "Force load"
    display.configuration.setSlot('forceLoad', true)
    expect(display.configForceLoad).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('force-load clears the banner even after zooming out past the capture', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    view.zoomTo(400)
    expect(display.regionTooLarge).toBe(true)

    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)
  })

  it('clears the cached estimate on region navigation so it cannot wedge', () => {
    const { display, view } = createTestEnvironment().createDisplay()

    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)

    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 8_000_000, refName: 'ctgA' },
    ])
    expect(display.byteEstimate).toBeUndefined()
    expect(display.regionTooLarge).toBe(false)
  })

  // Force-load approves the whole track, not one locus, so navigation must not
  // re-arm the gate — re-prompting on every chromosome is the friction the
  // track-wide flag replaced the per-region ceiling to avoid.
  it('keeps force-load across region navigation', () => {
    const { display, view } = createTestEnvironment().createDisplay()

    view.zoomTo(100)
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    display.setForceLoadTrack(true)
    expect(display.regionTooLarge).toBe(false)

    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 8_000_000, refName: 'ctgA' },
    ])
    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.forceLoadTrack).toBe(true)
    expect(display.regionTooLarge).toBe(false)
  })

  // The shared ClearHoverOnRegionTooLarge autorun (MultiRegionDisplayMixin)
  // fires the display's onRegionTooLarge hook when the banner trips; alignments
  // overrides it to clear the lingering hover, since the banner replaces the
  // pileup and a stale hover would pin to a now-hidden feature.
  it('clears the hover when the region becomes too large', () => {
    const { display, view } = createTestEnvironment().createDisplay()
    view.zoomTo(100)
    display.setFeatureIdUnderMouse('read-123')
    expect(display.featureIdUnderMouse).toBe('read-123')

    display.setByteEstimate({
      bytes: 1_500_000,
      measuredSpanBp: view.visibleBp,
    })
    expect(display.regionTooLarge).toBe(true)
    expect(display.featureIdUnderMouse).toBeUndefined()
  })
})
