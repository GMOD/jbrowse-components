import PluginManager from '@jbrowse/core/PluginManager'
import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'
import {
  BaseLinearDisplayComponent,
  GROW_MAX_HEIGHT,
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'
import { makeEmptyPileupData } from './testUtils.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Boots a real LinearAlignmentsDisplay with an assemblyManager mock so the
// containing LGV can actually initialize (measured width + ready assembly) —
// grow mode's `height` getter routes to `grownHeight` only once the view is
// initialized, and the bake-on-exit is likewise gated on init.
function createEnv() {
  console.warn = jest.fn()
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

  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearAlignmentsDisplay',
        configSchema,
        stateModel: stateModelFactory(configSchema),
        trackType: 'AlignmentsTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      }),
  )

  pluginManager.createPluggableElements()
  pluginManager.configure()

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
      { refName: 'ctgA', start: 0, end: 50_000, assemblyName: 'volvox' },
    ],
    getCanonicalRefName: (refName: string) => refName,
  }
  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
    })
    .volatile(() => ({
      rpcManager: { call: jest.fn() },
      assemblyManager: {
        get: (name: string) => (name === 'volvox' ? asm : undefined),
        isValidRefName: () => true,
      },
    }))
    .views(() => ({
      getTrackById(id: string) {
        return id === 'test_track' ? trackConfig : undefined
      },
      // every promotable slot read walks the cascade through this; nothing is
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
    }))

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
  return { view, display: view.tracks[0]!.displays[0]! }
}

// A measured view with `depth` reads all covering the same interval, so the
// pileup packs to exactly `depth` rows and the content height is predictable.
function createEnvWithPileup(depth: number) {
  const { view, display } = createEnv()
  view.setWidth(800)
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
  ])
  const readPositions = new Uint32Array(depth * 2)
  for (let i = 0; i < depth; i++) {
    readPositions[i * 2] = 1000
    readPositions[i * 2 + 1] = 5000
  }
  display.setRpcData(0, {
    groups: [
      {
        key: '',
        label: '',
        data: {
          ...makeEmptyPileupData(),
          readIds: Array.from({ length: depth }, (_, i) => `r${i}`),
          readNames: Array.from({ length: depth }, (_, i) => `r${i}`),
          readPositions,
          readYs: new Uint16Array(depth),
          readFlags: new Uint16Array(depth),
          readMapqs: new Uint8Array(depth),
          readStrands: new Int8Array(depth),
        },
      },
    ],
  })
  display.setLoadedRegion(0, {
    refName: 'ctgA',
    start: 0,
    end: 10_000,
    assemblyName: 'volvox',
  })
  return { view, display }
}

// Mirrors the canvas display's grow-mode contract: `height` follows the laid-out
// content reactively via the getter (no autorun writes the height config slot),
// and leaving grow bakes the height the user was seeing into the slot.
describe('alignments grow-mode reactive height', () => {
  // Before the view is measured, grow's content-height chain would throw
  // (view-geometry getters). The getter is guarded on `view.initialized` and
  // falls back to the slot, so hydrating a grow-mode session never throws.
  it('returns the slot pre-init instead of throwing', () => {
    const { display } = createEnv()
    display.setHeightMode('grow')
    expect(display.autoHeight).toBe(true)
    // alignments overrides the base height slot default to 250
    expect(display.height).toBe(250)
  })

  it('drives height from content without writing the slot; exit bakes it', () => {
    const { view, display } = createEnv()
    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
    ])
    expect(view.initialized).toBe(true)

    display.setHeightMode('grow')
    const grown = display.grownHeight
    // The coverage-band content height, distinct from the 250px slot default.
    expect(grown).not.toBe(250)
    // height tracks the content, but the persisted slot is untouched.
    expect(display.height).toBe(grown)
    expect(readConfObject(display.configuration, 'height')).toBe(250)

    // Leaving grow bakes the visual height into the slot (one deliberate write).
    display.setHeightMode('fixed')
    expect(readConfObject(display.configuration, 'height')).toBe(grown)
    expect(display.height).toBe(grown)
  })

  // The promotable cascade can flip a grow track out of grow mode WITHOUT
  // setHeightMode — resetting it to the inherit sentinel or a session-default
  // change flipping a track that follows the default. The bake is a reaction on
  // the resolved mode, so that exit bakes too, instead of snapping to the stale slot.
  it('bakes on a cascade-driven grow exit (reset), not just the menu action', () => {
    const { view, display } = createEnv()
    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
    ])

    display.setHeightMode('grow')
    const grown = display.grownHeight
    expect(grown).not.toBe(250)
    expect(display.height).toBe(grown)
    expect(readConfObject(display.configuration, 'height')).toBe(250)

    // Reset the slot to its unset sentinel default, exactly as clearing a
    // customized value does. Resolved heightMode falls to 'fixed' with no
    // setHeightMode call, so only the reaction can bake here.
    display.configuration.setSlot('heightMode', undefined)
    expect(display.autoHeight).toBe(false)
    expect(readConfObject(display.configuration, 'height')).toBe(grown)
    expect(display.height).toBe(grown)
  })

  // A drag-resize leaves grow mode AND applies a delta in the same action. The
  // bake must not clobber the drag delta: the height ends at grown + distance,
  // not just the baked grown height.
  it('a drag-resize leaving grow keeps the drag delta on top of the grown height', () => {
    const { view, display } = createEnv()
    view.setWidth(800)
    view.setDisplayedRegions([
      { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
    ])

    display.setHeightMode('grow')
    const grown = display.grownHeight
    expect(display.autoHeight).toBe(true)

    display.resizeHeight(40)
    expect(display.autoHeight).toBe(false)
    expect(display.heightMode).toBe('fixed')
    expect(display.height).toBe(grown + 40)
  })
})

// The grow ceiling is the `growMaxHeight` config slot, not a hardcoded constant.
// A pileup deeper than the ceiling is what makes "autogrow" read as inert: the
// track pins to the ceiling and scrolls the rest, which is indistinguishable
// from a fixed track of that height. Raising the slot has to actually raise it.
describe('the grow ceiling', () => {
  // The slot default is written as a literal so the generated config doc shows a
  // number rather than an identifier; this is what keeps it equal to the shared
  // default the canvas display's own slot uses.
  it('defaults to the shared GROW_MAX_HEIGHT', () => {
    const { display } = createEnv()
    expect(display.growMaxHeight).toBe(GROW_MAX_HEIGHT)
  })

  it('pins the track at the ceiling once the pileup outgrows it', () => {
    const { display } = createEnvWithPileup(300)
    display.setHeightMode('grow')
    expect(display.sections.contentHeight).toBeGreaterThan(
      display.growMaxHeight,
    )
    expect(display.height).toBe(display.growMaxHeight)
    expect(display.scrollableHeight).toBeGreaterThan(0)
  })

  it('grows past the default ceiling when the slot is raised', () => {
    const { display } = createEnvWithPileup(300)
    display.setHeightMode('grow')
    const contentHeight = display.sections.contentHeight
    display.configuration.setSlot('growMaxHeight', contentHeight + 100)
    expect(display.height).toBe(contentHeight)
    expect(display.scrollableHeight).toBe(0)
  })

  it('leaves a pileup that already fits under the ceiling alone', () => {
    const { display } = createEnvWithPileup(20)
    display.setHeightMode('grow')
    expect(display.height).toBe(display.sections.contentHeight)
    expect(display.height).toBeLessThan(display.growMaxHeight)
  })
})
