import { isValidElement } from 'react'

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
import { getFeatureHeightMenuItem } from './menus/featureSize.ts'
import stateModelFactory from './model.ts'

import type { Instance } from '@jbrowse/mobx-state-tree'

// Boots a real LinearAlignmentsDisplay so the showSoftClipping resolution and
// the promote/clear actions run against the actual MST model. The test Session
// backs get/setDisplayTypeDefault with the same nested-object store BaseSession
// uses (round-trip-tested in sessionModelFactory.test.ts); here we exercise how
// the display reads it. showSoftClipping is a promotable `maybeBoolean` slot,
// resolved through getConfResolved (track pin -> session default -> off).
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
      notify(_message: string, _level?: string) {},
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

// The fixed/grow/fit radios live under the nested "Track height" entry
// (mirroring the canvas display), so their pins are one level deeper than the
// size-preset pins. Module-level so tests in every describe block can reach it.
function heightModePinProps(
  display: ReturnType<typeof createDisplay>['display'],
  label: string,
) {
  const trackHeight = getFeatureHeightMenuItem(display).subMenu.find(
    i => i.label === 'Track height',
  )
  const sub =
    trackHeight && 'subMenu' in trackHeight ? (trackHeight.subMenu ?? []) : []
  const row = sub.find(i => 'label' in i && i.label === label)
  const adornment = row && 'endAdornment' in row ? row.endAdornment : undefined
  return isValidElement(adornment)
    ? (adornment.props as {
        isDefault: boolean
        onToggleDefault: () => void
      })
    : undefined
}

describe('alignments showSoftClipping session default', () => {
  it('is off by default with no config and no session default', () => {
    const { display } = createDisplay()
    expect(display.showSoftClipping).toBe(false)
    expect(display.softClippingSessionDefault.active).toBe(false)
  })

  it('follows a session-wide default of on when the track is not pinned', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'showSoftClipping',
      true,
    )
    expect(display.showSoftClipping).toBe(true)
    expect(display.softClippingSessionDefault.active).toBe(true)
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

  it('a track can pin off over an on session default (symmetric maybeBoolean)', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'showSoftClipping',
      true,
    )
    expect(display.showSoftClipping).toBe(true)
    // The capability the old plain-boolean slot lacked: an explicit off is a
    // real pin, not the un-set sentinel, so it wins over the on default.
    display.setShowSoftClipping(false)
    expect(display.showSoftClipping).toBe(false)
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

  describe('softClippingSessionDefault', () => {
    it('promotes soft-clipping-on as the session default', () => {
      const { session, display } = createDisplay({ showSoftClipping: true })
      expect(display.softClippingSessionDefault.active).toBe(false)

      display.softClippingSessionDefault.toggle()
      expect(
        session.getDisplayTypeDefault(
          'LinearAlignmentsDisplay',
          'showSoftClipping',
        ),
      ).toBe(true)
      expect(display.softClippingSessionDefault.active).toBe(true)
    })

    it('clears the session default when toggled off', () => {
      const { session, display } = createDisplay({ showSoftClipping: true })
      display.softClippingSessionDefault.toggle()
      expect(display.softClippingSessionDefault.active).toBe(true)

      display.softClippingSessionDefault.toggle()
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
// slots. Each resolves independently through getConfResolved (same rule as
// showSoftClipping): a slot at its schema default is un-pinned and follows the
// session-wide default; any other value pins it. heightMode='fixed' equals its
// promotedBase, so it never shows up as a sessionDefaultChanges diff. The menu's
// per-preset pins that promote these values are exercised below.
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
  })

  it('follows a session-wide compact default when the track is not pinned', () => {
    const { session, display } = createDisplay()
    setCompact(session)
    expect(display.featureHeight).toBe(3)
    expect(display.featureSpacing).toBe(0)
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

// The "Set feature height..." submenu surfaces the promote-as-default control as
// a per-preset pin (endAdornment) on each value row — not the former standalone
// "Use X as the default" checkbox. Each pin's isDefault/onToggleDefault is
// independent, so only the promoted preset reads as pinned.
describe('feature-height menu per-preset pins', () => {
  function pinProps(
    display: ReturnType<typeof createDisplay>['display'],
    label: string,
  ) {
    const row = getFeatureHeightMenuItem(display).subMenu.find(
      i => i.label === label,
    )
    const adornment =
      row && 'endAdornment' in row ? row.endAdornment : undefined
    return isValidElement(adornment)
      ? (adornment.props as {
          isDefault: boolean
          onToggleDefault: () => void
        })
      : undefined
  }

  it('has no standalone "as the default" checkbox row', () => {
    const { display } = createDisplay()
    expect(
      getFeatureHeightMenuItem(display).subMenu.some(i =>
        String(i.label).includes('as the default'),
      ),
    ).toBe(false)
  })

  it('gives every size preset its own pin', () => {
    const { display } = createDisplay()
    for (const label of ['Normal', 'Compact', 'Super-compact']) {
      expect(pinProps(display, label)).toBeDefined()
    }
  })

  it('gives every track-height mode its own pin', () => {
    const { display } = createDisplay()
    for (const label of [
      'Fixed height — scroll to see all reads',
      'Auto height — grow to fit all reads',
      'Compressed — squeeze all reads into view',
    ]) {
      expect(heightModePinProps(display, label)).toBeDefined()
    }
  })

  it("only the promoted preset's pin reads as active", () => {
    const { session, display } = createDisplay()
    setCompact(session)
    expect(pinProps(display, 'Compact')?.isDefault).toBe(true)
    expect(pinProps(display, 'Normal')?.isDefault).toBe(false)
    expect(pinProps(display, 'Super-compact')?.isDefault).toBe(false)
    expect(
      heightModePinProps(display, 'Compressed — squeeze all reads into view')
        ?.isDefault,
    ).toBe(false)
    expect(
      heightModePinProps(display, 'Auto height — grow to fit all reads')
        ?.isDefault,
    ).toBe(false)
  })

  it("clicking a preset's pin promotes that exact preset", () => {
    const { session, display } = createDisplay()
    pinProps(display, 'Compact')?.onToggleDefault()
    expect(
      session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'featureHeight'),
    ).toBe(3)
    expect(
      session.getDisplayTypeDefault(
        'LinearAlignmentsDisplay',
        'featureSpacing',
      ),
    ).toBe(0)
    expect(pinProps(display, 'Compact')?.isDefault).toBe(true)
  })

  it("the fit pin promotes heightMode='fit'", () => {
    const { session, display } = createDisplay()
    heightModePinProps(
      display,
      'Compressed — squeeze all reads into view',
    )?.onToggleDefault()
    expect(
      session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'heightMode'),
    ).toBe('fit')
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

// mismatchAlpha fades mismatch bases by their per-base Phred quality. It is a
// promotable `maybeBoolean` slot: resolved through getConfResolved (track pin →
// session default → off), reaches the renderers via renderState (tier-4
// rerender), and its "make default" pin is symmetric (unlike showSoftClipping,
// an explicit off can be pinned over an on session default).
describe('alignments mismatchAlpha (fade by base quality)', () => {
  it('is off by default', () => {
    const { display } = createDisplay()
    expect(display.mismatchAlpha).toBe(false)
  })

  it('setMismatchAlpha pins the config slot on and off', () => {
    const { display } = createDisplay()
    display.setMismatchAlpha(true)
    expect(display.mismatchAlpha).toBe(true)
    display.setMismatchAlpha(false)
    expect(display.mismatchAlpha).toBe(false)
  })

  it('follows a config default', () => {
    const { display } = createDisplay({ mismatchAlpha: true })
    expect(display.mismatchAlpha).toBe(true)
  })

  it('follows a session-wide default when the track is unpinned', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'mismatchAlpha',
      true,
    )
    expect(display.mismatchAlpha).toBe(true)
  })

  it('a track can pin off over an on session default (symmetric maybeBoolean)', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'mismatchAlpha',
      true,
    )
    expect(display.mismatchAlpha).toBe(true)
    display.setMismatchAlpha(false)
    expect(display.mismatchAlpha).toBe(false)
  })

  it('the pin promotes the current value as the session default', () => {
    const { session, display } = createDisplay()
    display.setMismatchAlpha(true)
    display.mismatchAlphaSessionDefault.toggle()
    expect(
      session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'mismatchAlpha'),
    ).toBe(true)
  })

  it('the top-level Show menu exposes the fade-by-quality toggle', () => {
    interface MenuNode {
      label?: string
      onClick?: () => void
      subMenu?: MenuNode[]
    }
    const byLabel = (items: MenuNode[] | undefined, label: string) =>
      items?.find(i => i.label === label)

    const { display } = createDisplay()
    const items = display.trackMenuItems() as MenuNode[]
    const show = byLabel(items, 'Show...')
    // Top-level Show item, not nested under Advanced.
    const item = byLabel(show?.subMenu, 'Fade mismatches by base quality')
    expect(item?.onClick).toBeDefined()
    item?.onClick?.()
    expect(display.mismatchAlpha).toBe(true)
  })
})

// `grow` is the third value of the shared `heightMode` vocabulary (with the
// canvas display): the track resizes to fit all reads rather than scrolling
// (fixed) or shrinking reads (fit). autoHeight/fitHeightToDisplay are mutually
// exclusive views of the one slot.
describe('alignments grow (auto-height) mode', () => {
  it('is off by default and mutually exclusive with fit', () => {
    const { display } = createDisplay()
    expect(display.autoHeight).toBe(false)

    display.setHeightMode('grow')
    expect(display.autoHeight).toBe(true)
    expect(display.fitHeightToDisplay).toBe(false)

    display.setHeightMode('fit')
    expect(display.autoHeight).toBe(false)
    expect(display.fitHeightToDisplay).toBe(true)

    display.setHeightMode('fixed')
    expect(display.autoHeight).toBe(false)
    expect(display.fitHeightToDisplay).toBe(false)
  })

  it('follows a session-wide grow default when the track is not pinned', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'heightMode',
      'grow',
    )
    expect(display.autoHeight).toBe(true)
  })

  it('caps the grown height at GROW_MAX_HEIGHT (800)', () => {
    const { display } = createDisplay()
    display.setHeightMode('grow')
    // no fetched reads -> content is just the coverage band, well under the cap
    expect(display.grownHeight).toBeLessThanOrEqual(800)
  })

  it('a manual drag-resize exits grow mode', () => {
    const { display } = createDisplay()
    display.setHeightMode('grow')
    expect(display.autoHeight).toBe(true)

    display.resizeHeight(50)
    expect(display.autoHeight).toBe(false)
  })

  it('picking a preset pins fixed and escapes even a promoted grow default', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'heightMode',
      'grow',
    )
    expect(display.autoHeight).toBe(true)

    display.setCompactness('compact')
    expect(display.autoHeight).toBe(false)
    expect(display.featureHeight).toBe(3)
  })

  it("the grow pin promotes heightMode='grow'", () => {
    const { session, display } = createDisplay()
    heightModePinProps(
      display,
      'Auto height — grow to fit all reads',
    )?.onToggleDefault()
    expect(
      session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'heightMode'),
    ).toBe('grow')
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
  })

  it('follows a session-wide scheme when the track is not pinned', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'colorBy',
      methylation,
    )
    expect(display.colorBy).toEqual(methylation)
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

  // colorBy's `validate` hook (configSchema.ts) rejects a `.type` that isn't a
  // registered COLOR_SCHEMES key — otherwise a stale/renamed scheme name saved
  // in a session-wide preference would reach the color-scheme lookups
  // (colorSchemeIndexFor, colorSchemeLabel, isModificationScheme), all of which
  // throw on an unrecognized type with no fallback.
  it('ignores an object-shaped session default naming an unregistered scheme', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault('LinearAlignmentsDisplay', 'colorBy', {
      type: 'a-removed-color-scheme',
    })
    expect(display.colorBy).toEqual({ type: 'normal' })
    expect(display.sessionDefaultChanges()).toEqual([])
  })
})

// linkedReads (view-as-pairs) is a sentinel promotable slot: 'inherit' is the
// un-pinned state (resolving to the session-wide default, else promotedBase
// 'off'), so a track can pin 'off' back over a session-wide 'normal' default —
// which a plain slot could not. getConfResolved never returns 'inherit'.
describe('alignments linkedReads (view as pairs) session default', () => {
  it('resolves to off by default with no config and no session default', () => {
    const { display } = createDisplay()
    expect(display.linkedReads).toBe('off')
    expect(display.pairsSessionDefault.active).toBe(false)
  })

  it('follows a session-wide normal (pairs) default when un-pinned', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'linkedReads',
      'normal',
    )
    expect(display.linkedReads).toBe('normal')
    expect(display.pairsSessionDefault.active).toBe(true)
    expect(display.sessionDefaultChanges()).toEqual([
      { path: ['linkedReads'], from: 'off', to: 'normal' },
    ])
  })

  it('a track pinned off wins over a session-wide normal default (the sentinel win)', () => {
    const { session, display } = createDisplay({ linkedReads: 'off' })
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'linkedReads',
      'normal',
    )
    // the whole reason for the sentinel: a track explicitly set to 'off' holds
    // off even under a session-wide pairs default, and reads as its own choice
    expect(display.linkedReads).toBe('off')
    expect(display.sessionDefaultChanges()).toEqual([])
  })

  it('ignores a malformed (non-enum) session default', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'linkedReads',
      'wobble',
    )
    expect(display.linkedReads).toBe('off')
  })

  describe('pairsSessionDefault', () => {
    it('promotes view-as-pairs as the session default', () => {
      const { session, display } = createDisplay({ linkedReads: 'normal' })
      expect(display.pairsSessionDefault.active).toBe(false)

      display.pairsSessionDefault.toggle()
      expect(
        session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'linkedReads'),
      ).toBe('normal')
      expect(display.pairsSessionDefault.active).toBe(true)
    })

    it('promotes pairs even when this track has them off (per-value)', () => {
      const { session, display } = createDisplay()
      expect(display.linkedReads).toBe('off')
      display.pairsSessionDefault.toggle()
      expect(
        session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'linkedReads'),
      ).toBe('normal')
      // an un-pinned track then follows the promoted default
      expect(display.linkedReads).toBe('normal')
    })

    it('clears the session default when toggled off', () => {
      const { session, display } = createDisplay({ linkedReads: 'normal' })
      display.pairsSessionDefault.toggle()
      expect(display.pairsSessionDefault.active).toBe(true)

      display.pairsSessionDefault.toggle()
      expect(
        session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'linkedReads'),
      ).toBeUndefined()
    })
  })
})

// readConnections (arcs / read cloud) is a sentinel promotable slot too.
describe('alignments readConnections (arcs) session default', () => {
  it('resolves to off by default with no config and no session default', () => {
    const { display } = createDisplay()
    expect(display.readConnections).toBe('off')
    expect(display.arcsSessionDefault.active).toBe(false)
    expect(display.readCloudSessionDefault.active).toBe(false)
  })

  it('follows a session-wide arc default when un-pinned', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'readConnections',
      'arc',
    )
    expect(display.readConnections).toBe('arc')
    expect(display.arcsSessionDefault.active).toBe(true)
    // the read-cloud pin targets a different on-value, so it stays inactive
    expect(display.readCloudSessionDefault.active).toBe(false)
    expect(display.sessionDefaultChanges()).toEqual([
      { path: ['readConnections'], from: 'off', to: 'arc' },
    ])
  })

  it('a track pinned off wins over a session-wide arc default', () => {
    const { session, display } = createDisplay({ readConnections: 'off' })
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'readConnections',
      'arc',
    )
    expect(display.readConnections).toBe('off')
    expect(display.sessionDefaultChanges()).toEqual([])
  })

  it('the arcs pin promotes arc and clears it (per-value)', () => {
    const { session, display } = createDisplay({ readConnections: 'arc' })
    display.arcsSessionDefault.toggle()
    expect(
      session.getDisplayTypeDefault(
        'LinearAlignmentsDisplay',
        'readConnections',
      ),
    ).toBe('arc')

    display.arcsSessionDefault.toggle()
    expect(
      session.getDisplayTypeDefault(
        'LinearAlignmentsDisplay',
        'readConnections',
      ),
    ).toBeUndefined()
  })
})
