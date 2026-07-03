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

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

// Boots a real LinearBasicDisplay (canvas) inside an LGV so the `displayMode`
// resolution getter and the `isDisplayModeDefault`/`toggleDisplayModeDefault`
// promotion actions run against the actual MST model. The test Session backs
// getDisplayTypeDefault/setDisplayTypeDefault with the same nested-object store
// BaseSession uses (that store is round-trip-tested separately in
// sessionModelFactory.test.ts); here we exercise how the display *reads* it.
// Mirrors the harness in expandToFit.test.ts.
function createDisplay(configDisplayMode?: DisplayMode) {
  const pluginManager = new PluginManager()
  const configSchema = configSchemaFactory(pluginManager)

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
    return new DisplayType({
      name: 'LinearBasicDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'FeatureTrack',
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
      type: 'FeatureTrack',
      trackId: 'test_track',
      assemblyNames: ['volvox'],
      displays: [
        configDisplayMode
          ? {
              type: 'LinearBasicDisplay',
              displayId: 'd1',
              displayMode: configDisplayMode,
            }
          : { type: 'LinearBasicDisplay', displayId: 'd1' },
      ],
    },
    { pluginManager },
  )

  const Session = types
    .model({
      name: 'testSession',
      view: types.maybe(LinearGenomeModel),
      configuration: types.map(types.frozen()),
      // Same shape as BaseSession's preferencesOverrides.displayTypeDefaults:
      // displayType -> slot -> value. Reassigned wholesale on set so the
      // display's getter tracks it reactively.
      displayTypeDefaults: types.frozen<
        Record<string, Record<string, unknown>>
      >({}),
    })
    .volatile(() => ({
      rpcManager: { call: jest.fn() },
      assemblyManager: { get: () => undefined },
    }))
    .views(self => ({
      get tracksById() {
        return { test_track: trackConfig }
      },
      get themeOptions() {
        return undefined
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
          type: 'FeatureTrack',
          configuration: 'test_track',
          displays: [{ type: 'LinearBasicDisplay', configuration: 'd1' }],
        },
      ],
    }),
  )
  view.setWidth(800)
  view.setDisplayedRegions([
    { assemblyName: 'volvox', start: 0, end: 10_000, refName: 'ctgA' },
  ])
  return { session, display: view.tracks[0]!.displays[0]! }
}

describe('canvas display displayMode resolution', () => {
  it('returns the config default (normal) when no session default is set', () => {
    const { display } = createDisplay()
    expect(display.displayMode).toBe('normal')
    expect(display.isDisplayModeDefault).toBe(false)
  })

  it('falls back to the session-wide default when config is the schema default', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearBasicDisplay',
      'displayMode',
      'compact',
    )
    // config displayMode is still the schema default 'normal', so the promoted
    // session default reaches this track without editing its config
    expect(display.displayMode).toBe('compact')
    expect(display.isDisplayModeDefault).toBe(true)
  })

  it('lets an explicit non-normal config win over the session default', () => {
    const { session, display } = createDisplay('superCompact')
    session.setDisplayTypeDefault(
      'LinearBasicDisplay',
      'displayMode',
      'compact',
    )
    // an explicit per-track choice is never overridden by the session default
    expect(display.displayMode).toBe('superCompact')
    expect(display.isDisplayModeDefault).toBe(false)
  })

  it('pins Normal over an opposite session default, then resetDisplayMode re-inherits', () => {
    // CSS inherit model: 'inherit' is the slot default, so choosing Normal now
    // *pins* it and holds over a superCompact session default. resetDisplayMode
    // ('inherit') is the un-pin path, not selecting Normal.
    const { session, display } = createDisplay('compact')
    session.setDisplayTypeDefault(
      'LinearBasicDisplay',
      'displayMode',
      'superCompact',
    )
    expect(display.displayMode).toBe('compact') // pinned compact wins

    display.setDisplayMode('normal') // pins normal explicitly
    expect(display.displayMode).toBe('normal') // holds over the superCompact default
    expect(display.isDisplayModePinned).toBe(true)
    expect(display.sessionDefaultChanges()).toEqual([]) // pinned, not inheriting

    display.resetDisplayMode() // un-pin -> follow the session default again
    expect(display.displayMode).toBe('superCompact')
    expect(display.sessionDefaultChanges()).toEqual([
      { path: ['displayMode'], from: 'normal', to: 'superCompact' },
    ])
  })

  it('resetDisplayMode un-pins a track so it follows the default again', () => {
    const { session, display } = createDisplay('compact')
    session.setDisplayTypeDefault(
      'LinearBasicDisplay',
      'displayMode',
      'superCompact',
    )
    expect(display.isDisplayModePinned).toBe(true)
    expect(display.displayMode).toBe('compact')

    display.resetDisplayMode()
    expect(display.isDisplayModePinned).toBe(false)
    // back to inheriting the session default
    expect(display.displayMode).toBe('superCompact')
    expect(display.sessionDefaultChanges()).toEqual([
      { path: ['displayMode'], from: 'normal', to: 'superCompact' },
    ])
  })

  it('an un-pinned track reports isDisplayModePinned false', () => {
    const { display } = createDisplay()
    expect(display.isDisplayModePinned).toBe(false)
    const { display: pinned } = createDisplay('compact')
    expect(pinned.isDisplayModePinned).toBe(true)
  })

  it('ignores a session default that is not a valid display mode', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearBasicDisplay',
      'displayMode',
      'nonsense',
    )
    expect(display.displayMode).toBe('normal')
    // the invalid value is rejected uniformly: the "make default" checkbox and
    // the session-default badge agree with the getter instead of reading the
    // garbage value as an active default
    expect(display.isDisplayModeDefault).toBe(false)
    expect(display.sessionDefaultChanges()).toEqual([])
  })

  it('ignores a default promoted for a different display type', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault('LinearArcDisplay', 'displayMode', 'compact')
    expect(display.displayMode).toBe('normal')
  })

  it('reacts to the session default changing after creation', () => {
    const { session, display } = createDisplay()
    expect(display.displayMode).toBe('normal')
    session.setDisplayTypeDefault(
      'LinearBasicDisplay',
      'displayMode',
      'superCompact',
    )
    expect(display.displayMode).toBe('superCompact')
    session.setDisplayTypeDefault(
      'LinearBasicDisplay',
      'displayMode',
      undefined,
    )
    expect(display.displayMode).toBe('normal')
  })

  describe('toggleDisplayModeDefault', () => {
    it('promotes the current mode to the session default', () => {
      const { session, display } = createDisplay('compact')
      expect(display.isDisplayModeDefault).toBe(false)

      display.toggleDisplayModeDefault()
      expect(
        session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
      ).toBe('compact')
      expect(display.isDisplayModeDefault).toBe(true)
    })

    it('clears the session default when the mode is already the default', () => {
      const { session, display } = createDisplay('compact')
      display.toggleDisplayModeDefault()
      expect(display.isDisplayModeDefault).toBe(true)

      display.toggleDisplayModeDefault()
      expect(
        session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
      ).toBeUndefined()
      expect(display.isDisplayModeDefault).toBe(false)
    })
  })

  describe('sessionDefaultChanges', () => {
    it('is empty when no session default affects the track', () => {
      const { display } = createDisplay()
      expect(display.sessionDefaultChanges()).toEqual([])
    })

    it('reports the config->resolved diff when a session default applies', () => {
      const { session, display } = createDisplay()
      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'compact',
      )
      expect(display.sessionDefaultChanges()).toEqual([
        { path: ['displayMode'], from: 'normal', to: 'compact' },
      ])
    })

    it('is empty when an explicit config overrides the session default', () => {
      const { session, display } = createDisplay('superCompact')
      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'compact',
      )
      // explicit config wins, so the resolved value equals the configured one
      expect(display.sessionDefaultChanges()).toEqual([])
    })

    it('clearSessionDefaults reverts the track and empties the changes', () => {
      const { session, display } = createDisplay()
      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'compact',
      )
      expect(display.displayMode).toBe('compact')

      display.clearSessionDefaults()
      expect(
        session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
      ).toBeUndefined()
      expect(display.displayMode).toBe('normal')
      expect(display.sessionDefaultChanges()).toEqual([])
    })
  })
})
