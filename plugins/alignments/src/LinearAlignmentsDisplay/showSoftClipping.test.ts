import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import {
  createBaseTrackConfig,
  createBaseTrackModel,
} from '@jbrowse/core/pluggableElementTypes/models'
import { types } from '@jbrowse/mobx-state-tree'
import {
  BaseLinearDisplayComponent,
  linearGenomeViewStateModelFactory as LinearGenomeViewModelFactory,
} from '@jbrowse/plugin-linear-genome-view'

import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Boots a real LinearAlignmentsDisplay so the showSoftClipping resolution and
// the promote/clear actions run against the actual MST model. The test Session
// backs get/setDisplayTypeDefault with the same nested-object store BaseSession
// uses (round-trip-tested in sessionModelFactory.test.ts); here we exercise how
// the display reads it. showSoftClipping stays a plain boolean that transparently
// consults that store — no tri-state/frozen slot.
function createDisplay(displayConfig: Record<string, unknown> = {}) {
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

  const LinearGenomeModel = LinearGenomeViewModelFactory(pluginManager)
  const trackConfigSchema = pluginManager.pluggableConfigSchemaType('track')
  const trackConfig = trackConfigSchema.create(
    {
      type: 'AlignmentsTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      displays: [
        { type: 'LinearAlignmentsDisplay', displayId: 'd1', ...displayConfig },
      ],
    },
    { pluginManager },
  )

  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
      // same shape as BaseSession's preferencesOverrides.displayTypeDefaults:
      // displayType -> slot -> value, reassigned wholesale so the display getter
      // tracks it reactively
      displayTypeDefaults: types.frozen<
        Record<string, Record<string, unknown>>
      >({}),
    })
    .volatile(() => ({
      rpcManager: {},
    }))
    .views(self => ({
      getTracksById() {
        return { test_track: trackConfig }
      },
      get tracksById() {
        return this.getTracksById()
      },
      getDisplayTypeDefault(displayType: string, slot: string): unknown {
        return self.displayTypeDefaults[displayType]?.[slot]
      },
    }))
    .actions(self => ({
      setView(view: Instance<typeof LinearGenomeModel>) {
        self.view = view
        return view
      },
      setDisplayTypeDefault(displayType: string, slot: string, value: unknown) {
        const forType = { ...self.displayTypeDefaults[displayType] }
        if (value === undefined) {
          delete forType[slot]
        } else {
          forType[slot] = value
        }
        self.displayTypeDefaults = {
          ...self.displayTypeDefaults,
          [displayType]: forType,
        }
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
          displays: [{ type: 'LinearAlignmentsDisplay', configuration: 'd1' }],
        },
      ],
    }),
  )
  return { session, display: view.tracks[0]!.displays[0]! }
}

describe('alignments showSoftClipping session default', () => {
  it('is off by default with no config and no session default', () => {
    const { display } = createDisplay()
    expect(display.showSoftClipping).toBe(false)
    expect(display.isShowSoftClippingDefault).toBe(false)
  })

  it('follows a session-wide default of on when the track is not pinned', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'showSoftClipping',
      true,
    )
    expect(display.showSoftClipping).toBe(true)
    expect(display.isShowSoftClippingDefault).toBe(true)
    expect(display.sessionDefaultChanges()).toEqual([
      { path: ['showSoftClipping'], from: false, to: true },
    ])
  })

  it('a config-pinned on wins and reads as its own choice, not the default', () => {
    const { session, display } = createDisplay({ showSoftClipping: true })
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'showSoftClipping',
      false,
    )
    // pinned on regardless of the session default; not "affected by a default"
    expect(display.showSoftClipping).toBe(true)
    expect(display.sessionDefaultChanges()).toEqual([])
  })

  it('reacts to the session default changing after creation', () => {
    const { session, display } = createDisplay()
    expect(display.showSoftClipping).toBe(false)
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'showSoftClipping',
      true,
    )
    expect(display.showSoftClipping).toBe(true)
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'showSoftClipping',
      undefined,
    )
    expect(display.showSoftClipping).toBe(false)
  })

  it('ignores a default promoted for a different display type', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearBasicDisplay',
      'showSoftClipping',
      true,
    )
    expect(display.showSoftClipping).toBe(false)
  })

  it('ignores a non-boolean session default', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'showSoftClipping',
      'yes',
    )
    expect(display.showSoftClipping).toBe(false)
  })

  describe('toggleShowSoftClippingDefault', () => {
    it('promotes the current on value to the session default', () => {
      const { session, display } = createDisplay({ showSoftClipping: true })
      expect(display.isShowSoftClippingDefault).toBe(false)

      display.toggleShowSoftClippingDefault()
      expect(
        session.getDisplayTypeDefault(
          'LinearAlignmentsDisplay',
          'showSoftClipping',
        ),
      ).toBe(true)
      expect(display.isShowSoftClippingDefault).toBe(true)
    })

    it('clears the session default when it is already the default', () => {
      const { session, display } = createDisplay({ showSoftClipping: true })
      display.toggleShowSoftClippingDefault()
      expect(display.isShowSoftClippingDefault).toBe(true)

      display.toggleShowSoftClippingDefault()
      expect(
        session.getDisplayTypeDefault(
          'LinearAlignmentsDisplay',
          'showSoftClipping',
        ),
      ).toBeUndefined()
    })
  })

  it('clearSessionDefaults reverts inheriting tracks and empties the changes', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'showSoftClipping',
      true,
    )
    expect(display.showSoftClipping).toBe(true)

    display.clearSessionDefaults()
    expect(
      session.getDisplayTypeDefault(
        'LinearAlignmentsDisplay',
        'showSoftClipping',
      ),
    ).toBeUndefined()
    expect(display.showSoftClipping).toBe(false)
    expect(display.sessionDefaultChanges()).toEqual([])
  })
})

// Compactness is just the featureHeight + featureSpacing promotable slots moved
// together behind one menu item. Each slot resolves independently through
// getConfResolved (same rule as showSoftClipping): a slot at its schema default
// is un-pinned and follows the session-wide default; any other value pins it.
const setCompact = (session: {
  setDisplayTypeDefault: (t: string, s: string, v: unknown) => void
}) => {
  session.setDisplayTypeDefault('LinearAlignmentsDisplay', 'featureHeight', 3)
  session.setDisplayTypeDefault('LinearAlignmentsDisplay', 'featureSpacing', 0)
}

describe('alignments compactness session default', () => {
  it('is Normal by default with no config and no session default', () => {
    const { display } = createDisplay()
    expect(display.featureHeight).toBe(7)
    expect(display.featureSpacing).toBe(1)
    expect(display.isCompactnessDefault).toBe(false)
  })

  it('follows a session-wide compact default when the track is not pinned', () => {
    const { session, display } = createDisplay()
    setCompact(session)
    expect(display.featureHeight).toBe(3)
    expect(display.featureSpacing).toBe(0)
    expect(display.isCompactnessDefault).toBe(true)
    expect(display.sessionDefaultChanges()).toEqual([
      { path: ['featureHeight'], from: 7, to: 3 },
      { path: ['featureSpacing'], from: 1, to: 0 },
    ])
  })

  it('an explicit per-track size wins over the session default', () => {
    const { session, display } = createDisplay({
      featureHeight: 3,
      featureSpacing: 0,
    })
    session.setDisplayTypeDefault('LinearAlignmentsDisplay', 'featureHeight', 1)
    // pinned regardless of the (super-compact) session default
    expect(display.featureHeight).toBe(3)
    expect(display.sessionDefaultChanges()).toEqual([])
  })

  it('reacts to the session default changing after creation', () => {
    const { session, display } = createDisplay()
    expect(display.featureHeight).toBe(7)
    session.setDisplayTypeDefault('LinearAlignmentsDisplay', 'featureHeight', 3)
    expect(display.featureHeight).toBe(3)
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'featureHeight',
      undefined,
    )
    expect(display.featureHeight).toBe(7)
  })

  it('ignores a default promoted for a different display type', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault('LinearBasicDisplay', 'featureHeight', 3)
    expect(display.featureHeight).toBe(7)
  })

  it('ignores a malformed (wrong-type) session default', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'featureHeight',
      'compact',
    )
    expect(display.featureHeight).toBe(7)
  })

  describe('toggleCompactnessDefault', () => {
    it('promotes the current size to the session default', () => {
      const { session, display } = createDisplay({
        featureHeight: 3,
        featureSpacing: 0,
      })
      expect(display.isCompactnessDefault).toBe(false)

      display.toggleCompactnessDefault()
      expect(
        session.getDisplayTypeDefault(
          'LinearAlignmentsDisplay',
          'featureHeight',
        ),
      ).toBe(3)
      expect(
        session.getDisplayTypeDefault(
          'LinearAlignmentsDisplay',
          'featureSpacing',
        ),
      ).toBe(0)
      expect(display.isCompactnessDefault).toBe(true)
    })

    it('promotes a custom (non-preset) size too', () => {
      const { session, display } = createDisplay({
        featureHeight: 5,
        featureSpacing: 2,
      })
      display.toggleCompactnessDefault()
      expect(
        session.getDisplayTypeDefault(
          'LinearAlignmentsDisplay',
          'featureHeight',
        ),
      ).toBe(5)
      expect(
        session.getDisplayTypeDefault(
          'LinearAlignmentsDisplay',
          'featureSpacing',
        ),
      ).toBe(2)
    })

    it('clears the session default when it is already the default', () => {
      const { session, display } = createDisplay({
        featureHeight: 3,
        featureSpacing: 0,
      })
      display.toggleCompactnessDefault()
      expect(display.isCompactnessDefault).toBe(true)

      display.toggleCompactnessDefault()
      expect(
        session.getDisplayTypeDefault(
          'LinearAlignmentsDisplay',
          'featureHeight',
        ),
      ).toBeUndefined()
      expect(
        session.getDisplayTypeDefault(
          'LinearAlignmentsDisplay',
          'featureSpacing',
        ),
      ).toBeUndefined()
    })
  })

  it('clearSessionDefaults reverts inheriting tracks and empties changes', () => {
    const { session, display } = createDisplay()
    setCompact(session)
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'showSoftClipping',
      true,
    )
    expect(display.featureHeight).toBe(3)
    expect(display.showSoftClipping).toBe(true)

    display.clearSessionDefaults()
    expect(display.featureHeight).toBe(7)
    expect(display.showSoftClipping).toBe(false)
    expect(display.sessionDefaultChanges()).toEqual([])
  })

  it('reports both soft-clipping and compactness changes together', () => {
    const { session, display } = createDisplay()
    setCompact(session)
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'showSoftClipping',
      true,
    )
    // promotable slots reported in schema-definition order
    expect(display.sessionDefaultChanges()).toEqual([
      { path: ['featureHeight'], from: 7, to: 3 },
      { path: ['featureSpacing'], from: 1, to: 0 },
      { path: ['showSoftClipping'], from: false, to: true },
    ])
  })
})
