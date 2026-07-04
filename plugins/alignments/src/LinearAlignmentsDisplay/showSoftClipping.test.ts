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

  describe('setShowSoftClippingDefault', () => {
    it('promotes the current on value to the session default', () => {
      const { session, display } = createDisplay({ showSoftClipping: true })
      expect(display.isShowSoftClippingDefault).toBe(false)

      display.setShowSoftClippingDefault(true)
      expect(
        session.getDisplayTypeDefault(
          'LinearAlignmentsDisplay',
          'showSoftClipping',
        ),
      ).toBe(true)
      expect(display.isShowSoftClippingDefault).toBe(true)
    })

    it('clears the session default when promote is false', () => {
      const { session, display } = createDisplay({ showSoftClipping: true })
      display.setShowSoftClippingDefault(true)
      expect(display.isShowSoftClippingDefault).toBe(true)

      display.setShowSoftClippingDefault(false)
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

// Compactness is the featureHeight + featureSpacing + heightMode promotable
// slots moved together behind one menu item. Each resolves independently through
// getConfResolved (same rule as showSoftClipping): a slot at its schema default
// is un-pinned and follows the session-wide default; any other value pins it.
// heightMode='fixed' equals its promotedBase, so it never shows up as a
// sessionDefaultChanges diff — it only gates isCompactnessDefault.
const setCompact = (session: {
  setDisplayTypeDefault: (t: string, s: string, v: unknown) => void
}) => {
  session.setDisplayTypeDefault('LinearAlignmentsDisplay', 'featureHeight', 3)
  session.setDisplayTypeDefault('LinearAlignmentsDisplay', 'featureSpacing', 0)
  session.setDisplayTypeDefault(
    'LinearAlignmentsDisplay',
    'heightMode',
    'fixed',
  )
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

  describe('setCompactnessDefault', () => {
    it('promotes the current size to the session default', () => {
      const { session, display } = createDisplay({
        featureHeight: 3,
        featureSpacing: 0,
      })
      expect(display.isCompactnessDefault).toBe(false)

      display.setCompactnessDefault(true)
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
      display.setCompactnessDefault(true)
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

    it('clears the session default when promote is false', () => {
      const { session, display } = createDisplay({
        featureHeight: 3,
        featureSpacing: 0,
      })
      display.setCompactnessDefault(true)
      expect(display.isCompactnessDefault).toBe(true)

      display.setCompactnessDefault(false)
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

// Fit-to-display-height is the `heightMode` sentinel promotable slot
// ('inherit' | 'fit' | 'fixed', promotedBase 'fixed'). It rides the same
// "make default" grouping as featureHeight/featureSpacing so promoting a fit
// track persists fit — not a frozen pixel size. Being a sentinel lets a track
// pin 'fixed' back over a session-wide 'fit' default, which a plain boolean
// could not (false would collapse to the default and re-inherit fit).
describe('alignments fit-to-display-height session default', () => {
  it('is off by default with no config and no session default', () => {
    const { display } = createDisplay()
    expect(display.fitHeightToDisplay).toBe(false)
  })

  it('setFitHeightToDisplay(true) enters fit mode', () => {
    const { display } = createDisplay()
    display.setFitHeightToDisplay(true)
    expect(display.fitHeightToDisplay).toBe(true)
  })

  it('follows a session-wide fit default when the track is not pinned', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'heightMode',
      'fit',
    )
    expect(display.fitHeightToDisplay).toBe(true)
  })

  it('promotes the current fit mode to the session default', () => {
    const { session, display } = createDisplay()
    display.setFitHeightToDisplay(true)
    expect(display.isCompactnessDefault).toBe(false)

    display.setCompactnessDefault(true)
    expect(
      session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'heightMode'),
    ).toBe('fit')
    expect(display.isCompactnessDefault).toBe(true)
  })

  it('picking a preset pins fixed and escapes even a promoted fit default', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'heightMode',
      'fit',
    )
    expect(display.fitHeightToDisplay).toBe(true)

    display.setCompactness('compact')
    // the sentinel win: 'fixed' pins over the 'fit' session default
    expect(display.fitHeightToDisplay).toBe(false)
    expect(display.featureHeight).toBe(3)
  })

  it('setFeatureHeight escapes fit mode', () => {
    const { display } = createDisplay()
    display.setFitHeightToDisplay(true)
    expect(display.fitHeightToDisplay).toBe(true)

    display.setFeatureHeight(20)
    expect(display.fitHeightToDisplay).toBe(false)
  })

  it('ignores a malformed (non-enum) session default', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'heightMode',
      'wobble',
    )
    expect(display.fitHeightToDisplay).toBe(false)
  })
})

// The fit split: while fit is on, featureHeight/featureSpacing don't read the
// config slots — they carve the autorun-cached fit pitch (`fittedHeightPx` =
// pileupSpace/rows) into a read body plus spacing. Here we drive `fittedHeightPx`
// directly (the driving autorun leaves it at 0 with no fetched reads, and
// nothing it tracks changes when we set it, so the value sticks) to exercise the
// split the layout/GPU/SVG consumers actually see. The invariant under test is
// body + spacing === pitch, so the pileup fills the display exactly.
describe('alignments fit-to-display-height split', () => {
  it('with nothing to fit, fittedFeatureHeight is 0 and size falls back to config', () => {
    const { display } = createDisplay()
    display.setFitHeightToDisplay(true)
    // no fetched reads -> no rows -> nothing to fit
    expect(display.fittedFeatureHeight).toBe(0)
    expect(display.featureHeight).toBe(7)
    expect(display.featureSpacing).toBe(1)
  })

  it('spares a 1px gap once the pitch clears 3px, body fills the rest', () => {
    const { display } = createDisplay()
    display.setFitHeightToDisplay(true)
    display.setFittedHeightPx(10)
    expect(display.featureSpacing).toBe(1)
    expect(display.featureHeight).toBe(9)
    // body + spacing reconstructs the pitch exactly
    expect(display.featureHeight + display.featureSpacing).toBe(10)
  })

  it('keeps reads flush (no spacing) at a 3px pitch or tighter', () => {
    const { display } = createDisplay()
    display.setFitHeightToDisplay(true)
    display.setFittedHeightPx(3)
    expect(display.featureSpacing).toBe(0)
    expect(display.featureHeight).toBe(3)

    display.setFittedHeightPx(2)
    expect(display.featureSpacing).toBe(0)
    expect(display.featureHeight).toBe(2)
  })

  it('splits a fractional pitch without losing the fill (body stays fractional)', () => {
    const { display } = createDisplay()
    display.setFitHeightToDisplay(true)
    display.setFittedHeightPx(3.5)
    expect(display.featureSpacing).toBe(1)
    expect(display.featureHeight).toBe(2.5)
    expect(display.featureHeight + display.featureSpacing).toBe(3.5)
  })

  it('ignores a stale fit cache once fit is off', () => {
    const { display } = createDisplay()
    display.setFitHeightToDisplay(true)
    display.setFittedHeightPx(10)
    expect(display.featureHeight).toBe(9)

    // leaving fit doesn't reset the cache, but the getters gate on fit mode so
    // the config values win again
    display.setFitHeightToDisplay(false)
    expect(display.featureHeight).toBe(7)
    expect(display.featureSpacing).toBe(1)
  })
})

// colorBy is a plain (object-valued) promotable slot: `{ type: 'normal' }` is
// both the base default and the un-pinned signal, so a track at normal follows a
// session-wide color default and picking any other scheme pins it. Exercises the
// structural (not identity) comparison in promotableDefaults.
describe('alignments colorBy session default', () => {
  const methylation = { type: 'methylation' }

  it('resolves to normal by default with no config and no session default', () => {
    const { display } = createDisplay()
    expect(display.colorBy).toEqual({ type: 'normal' })
    expect(display.isColorByDefault).toBe(false)
  })

  it('follows a session-wide scheme when the track is not pinned', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'colorBy',
      methylation,
    )
    expect(display.colorBy).toEqual(methylation)
    expect(display.isColorByDefault).toBe(true)
    expect(display.sessionDefaultChanges()).toEqual([
      { path: ['colorBy'], from: { type: 'normal' }, to: methylation },
    ])
  })

  it('a track at normal follows the default (normal is the un-pin signal)', () => {
    const { session, display } = createDisplay({ colorBy: { type: 'normal' } })
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'colorBy',
      methylation,
    )
    // plain slot: normal equals the default, so the track reads as un-pinned and
    // follows the session-wide default rather than forcing normal
    expect(display.colorBy).toEqual(methylation)
    expect(display.sessionDefaultChanges()).toEqual([
      { path: ['colorBy'], from: { type: 'normal' }, to: methylation },
    ])
  })

  it('an explicit per-track scheme wins over the session default', () => {
    const { session, display } = createDisplay({ colorBy: { type: 'strand' } })
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'colorBy',
      methylation,
    )
    expect(display.colorBy).toEqual({ type: 'strand' })
    expect(display.sessionDefaultChanges()).toEqual([])
  })

  it('reacts to the session default changing after creation', () => {
    const { session, display } = createDisplay()
    expect(display.colorBy).toEqual({ type: 'normal' })
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'colorBy',
      methylation,
    )
    expect(display.colorBy).toEqual(methylation)
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'colorBy',
      undefined,
    )
    expect(display.colorBy).toEqual({ type: 'normal' })
  })

  it('ignores a null or non-object session default', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault('LinearAlignmentsDisplay', 'colorBy', null)
    expect(display.colorBy).toEqual({ type: 'normal' })
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'colorBy',
      'methylation',
    )
    expect(display.colorBy).toEqual({ type: 'normal' })
  })

  describe('setColorByDefault', () => {
    it('promotes the current scheme to the session default', () => {
      const { session, display } = createDisplay({ colorBy: methylation })
      expect(display.isColorByDefault).toBe(false)

      display.setColorByDefault(true)
      expect(
        session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'colorBy'),
      ).toEqual(methylation)
      expect(display.isColorByDefault).toBe(true)
    })

    it('clears the session default when promote is false', () => {
      const { session, display } = createDisplay({ colorBy: methylation })
      display.setColorByDefault(true)
      expect(display.isColorByDefault).toBe(true)

      display.setColorByDefault(false)
      expect(
        session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'colorBy'),
      ).toBeUndefined()
    })
  })
})
