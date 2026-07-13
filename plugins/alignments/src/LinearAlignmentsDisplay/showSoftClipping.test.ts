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
  getTrackSizingMenuItem,
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

// The fixed/grow/fit radios live in the sibling "Track sizing" menu (built by
// the shared getTrackSizingMenuItem, mirroring the canvas display), separate
// from the "Read height" size presets. Module-level so tests in every describe
// block can reach it.
function heightModePinProps(
  display: ReturnType<typeof createDisplay>['display'],
  label: string,
) {
  const trackSizing = getTrackSizingMenuItem(display, 'reads')
  const sub = 'subMenu' in trackSizing ? trackSizing.subMenu : []
  const row = sub.find(i => 'label' in i && i.label === label)
  const adornment = row && 'endAdornment' in row ? row.endAdornment : undefined
  return isValidElement(adornment)
    ? (adornment.props as {
        control: { active: boolean; toggle: () => void }
        label?: string
      })
    : undefined
}

describe('alignments showSoftClipping session default', () => {
  it('is off by default with no config and no session default', () => {
    const { display } = createDisplay()
    expect(display.showSoftClipping).toBe(false)
    expect(display.softClippingDisplayTypeDefault.active).toBe(false)
  })

  it('follows a session-wide default of on when the track is not customized', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'showSoftClipping',
      true,
    )
    expect(display.showSoftClipping).toBe(true)
    expect(display.softClippingDisplayTypeDefault.active).toBe(true)
    expect(display.displayTypeDefaultChanges()).toEqual([
      { path: ['showSoftClipping'], from: false, to: true },
    ])
  })

  it('a config-customized on wins and reads as its own choice, not the default', () => {
    const { session, display } = createDisplay({ showSoftClipping: true })
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'showSoftClipping',
      false,
    )
    // customized on regardless of the session default; not "affected by a default"
    expect(display.showSoftClipping).toBe(true)
    expect(display.displayTypeDefaultChanges()).toEqual([])
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

  describe('softClippingDisplayTypeDefault', () => {
    it('promotes soft-clipping-on as the session default', () => {
      const { session, display } = createDisplay({ showSoftClipping: true })
      expect(display.softClippingDisplayTypeDefault.active).toBe(false)

      display.softClippingDisplayTypeDefault.toggle()
      expect(
        session.getDisplayTypeDefault(
          'LinearAlignmentsDisplay',
          'showSoftClipping',
        ),
      ).toBe(true)
      expect(display.softClippingDisplayTypeDefault.active).toBe(true)
    })

    it('clears the session default when toggled off', () => {
      const { session, display } = createDisplay({ showSoftClipping: true })
      display.softClippingDisplayTypeDefault.toggle()
      expect(display.softClippingDisplayTypeDefault.active).toBe(true)

      display.softClippingDisplayTypeDefault.toggle()
      expect(
        session.getDisplayTypeDefault(
          'LinearAlignmentsDisplay',
          'showSoftClipping',
        ),
      ).toBeUndefined()
    })
  })

  it('clearDisplayTypeDefaults reverts inheriting tracks and empties the changes', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'showSoftClipping',
      true,
    )
    expect(display.showSoftClipping).toBe(true)

    display.clearDisplayTypeDefaults()
    expect(
      session.getDisplayTypeDefault(
        'LinearAlignmentsDisplay',
        'showSoftClipping',
      ),
    ).toBeUndefined()
    expect(display.showSoftClipping).toBe(false)
    expect(display.displayTypeDefaultChanges()).toEqual([])
  })
})

// Compactness is the featureHeight + featureSpacing + heightMode promotable
// slots. Each resolves independently through getConfResolved (same rule as
// showSoftClipping): a slot at its schema default follows the
// session-wide default; any other value pins it. heightMode='fixed' equals its
// promotedBase, so it never shows up as a displayTypeDefaultChanges diff. The menu's
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

  it('follows a session-wide compact default when the track is not customized', () => {
    const { session, display } = createDisplay()
    setCompact(session)
    expect(display.featureHeight).toBe(3)
    expect(display.featureSpacing).toBe(0)
    expect(display.displayTypeDefaultChanges()).toEqual([
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
    // customized regardless of the (super-compact) session default
    expect(display.featureHeight).toBe(3)
    expect(display.displayTypeDefaultChanges()).toEqual([])
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

  it('clearDisplayTypeDefaults reverts inheriting tracks and empties changes', () => {
    const { session, display } = createDisplay()
    setCompact(session)
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'showSoftClipping',
      true,
    )
    expect(display.featureHeight).toBe(3)
    expect(display.showSoftClipping).toBe(true)

    display.clearDisplayTypeDefaults()
    expect(display.featureHeight).toBe(7)
    expect(display.showSoftClipping).toBe(false)
    expect(display.displayTypeDefaultChanges()).toEqual([])
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
    expect(display.displayTypeDefaultChanges()).toEqual([
      { path: ['featureHeight'], from: 7, to: 3 },
      { path: ['featureSpacing'], from: 1, to: 0 },
      { path: ['showSoftClipping'], from: false, to: true },
    ])
  })
})

// The "Read height" submenu surfaces the promote-as-default control as
// a per-preset pin (endAdornment) on each value row — not the former standalone
// "Use X as the default" checkbox. Each pin's isDefault/onToggleDefault is
// independent, so only the promoted preset reads as customized.
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
          control: { active: boolean; toggle: () => void }
          label?: string
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
      'Scroll to see all reads',
      'Expand to fit all reads',
      'Squeeze all reads into view',
    ]) {
      expect(heightModePinProps(display, label)).toBeDefined()
    }
  })

  it("only the promoted preset's pin reads as active", () => {
    const { session, display } = createDisplay()
    setCompact(session)
    expect(pinProps(display, 'Compact')?.control.active).toBe(true)
    expect(pinProps(display, 'Normal')?.control.active).toBe(false)
    expect(pinProps(display, 'Super-compact')?.control.active).toBe(false)
    expect(
      heightModePinProps(display, 'Squeeze all reads into view')?.control
        .active,
    ).toBe(false)
    expect(
      heightModePinProps(display, 'Expand to fit all reads')?.control.active,
    ).toBe(false)
  })

  it("clicking a preset's pin promotes that exact preset", () => {
    const { session, display } = createDisplay()
    pinProps(display, 'Compact')?.control.toggle()
    expect(
      session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'featureHeight'),
    ).toBe(3)
    expect(
      session.getDisplayTypeDefault(
        'LinearAlignmentsDisplay',
        'featureSpacing',
      ),
    ).toBe(0)
    expect(pinProps(display, 'Compact')?.control.active).toBe(true)
  })

  it("the fit pin promotes heightMode='fit'", () => {
    const { session, display } = createDisplay()
    heightModePinProps(display, 'Squeeze all reads into view')?.control.toggle()
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

  it("setHeightMode('fit') enters fit mode", () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    expect(display.fitHeightToDisplay).toBe(true)
  })

  it('follows a session-wide fit default when the track is not customized', () => {
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

    display.setFeatureHeight(3)
    // the sentinel win: 'fixed' pins over the 'fit' session default
    expect(display.fitHeightToDisplay).toBe(false)
    expect(display.featureHeight).toBe(3)
  })

  it('setFeatureHeight escapes fit mode', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    expect(display.fitHeightToDisplay).toBe(true)

    display.setFeatureHeight(20)
    expect(display.fitHeightToDisplay).toBe(false)
  })

  // The "Set feature height" dialog edits the fixed config, so it must seed from
  // `configuredFeature*` — the resolved `featureHeight`/`featureSpacing` become
  // the fractional fit pitch in Compressed mode, which the dialog would then bake.
  it('exposes configured feature size independent of the fit squeeze', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setFittedHeightPx(4)

    // resolved size follows the fit pitch (4px pitch = 3px body + 1px spacing)
    expect(display.featureHeight).toBe(3)
    expect(display.featureSpacing).toBe(1)

    // ...but the configured size the dialog edits stays at the config defaults
    expect(display.configuredFeatureHeight).toBe(7)
    expect(display.configuredFeatureSpacing).toBe(1)
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
// an explicit off can be customized over an on session default).
describe('alignments mismatchAlpha (fade by base quality)', () => {
  it('is off by default', () => {
    const { display } = createDisplay()
    expect(display.mismatchAlpha).toBe(false)
  })

  it('setMismatchAlpha sets the config slot on and off', () => {
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

  it('follows a session-wide default when the track is not customized', () => {
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
    display.mismatchAlphaDisplayTypeDefault.toggle()
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

  it('follows a session-wide grow default when the track is not customized', () => {
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

    display.setFeatureHeight(3)
    expect(display.autoHeight).toBe(false)
    expect(display.featureHeight).toBe(3)
  })

  it("the grow pin promotes heightMode='grow'", () => {
    const { session, display } = createDisplay()
    heightModePinProps(display, 'Expand to fit all reads')?.control.toggle()
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
    display.setHeightMode('fit')
    // no fetched reads -> no rows -> nothing to fit
    expect(display.fittedFeatureHeight).toBe(0)
    expect(display.featureHeight).toBe(7)
    expect(display.featureSpacing).toBe(1)
  })

  it('spares a 1px gap once the pitch clears 3px, body fills the rest', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setFittedHeightPx(10)
    expect(display.featureSpacing).toBe(1)
    expect(display.featureHeight).toBe(9)
    // body + spacing reconstructs the pitch exactly
    expect(display.featureHeight + display.featureSpacing).toBe(10)
  })

  it('keeps reads flush (no spacing) at a 3px pitch or tighter', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setFittedHeightPx(3)
    expect(display.featureSpacing).toBe(0)
    expect(display.featureHeight).toBe(3)

    display.setFittedHeightPx(2)
    expect(display.featureSpacing).toBe(0)
    expect(display.featureHeight).toBe(2)
  })

  it('splits a fractional pitch without losing the fill (body stays fractional)', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setFittedHeightPx(3.5)
    expect(display.featureSpacing).toBe(1)
    expect(display.featureHeight).toBe(2.5)
    expect(display.featureHeight + display.featureSpacing).toBe(3.5)
  })

  it('ignores a stale fit cache once fit is off', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setFittedHeightPx(10)
    expect(display.featureHeight).toBe(9)

    // leaving fit doesn't reset the cache, but the getters gate on fit mode so
    // the config values win again
    display.setHeightMode('fixed')
    expect(display.featureHeight).toBe(7)
    expect(display.featureSpacing).toBe(1)
  })
})

// colorBy is a sentinel (object-valued) promotable slot: `{ type: 'inherit' }`
// is the inherit default and `promotedBase` (`{ type: 'normal' }`) is what it
// resolves to, so a track following the default follows a session-wide color default while
// every real scheme — `normal` included — is customizable over it. Exercises the
// structural (not identity) comparison in promotableDefaults.
describe('alignments colorBy session default', () => {
  const methylation = { type: 'methylation' }

  it('resolves to normal by default with no config and no session default', () => {
    const { display } = createDisplay()
    expect(display.colorBy).toEqual({ type: 'normal' })
  })

  it('follows a session-wide scheme when the track is not customized', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'colorBy',
      methylation,
    )
    expect(display.colorBy).toEqual(methylation)
    expect(display.displayTypeDefaultChanges()).toEqual([
      { path: ['colorBy'], from: { type: 'normal' }, to: methylation },
    ])
  })

  it('a track customized to normal wins over an opposite session default', () => {
    const { session, display } = createDisplay({ colorBy: { type: 'normal' } })
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'colorBy',
      methylation,
    )
    // sentinel slot: `{type:'normal'}` differs from the `{type:'inherit'}`
    // default, so it customizes the track — normal is forced over the methylation
    // default (impossible with the old plain-default slot). Not an inherited
    // change, so displayTypeDefaultChanges is empty.
    expect(display.colorBy).toEqual({ type: 'normal' })
    expect(display.displayTypeDefaultChanges()).toEqual([])
  })

  it('setColorScheme(normal) pins normal over an opposite session default', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'colorBy',
      methylation,
    )
    expect(display.colorBy).toEqual(methylation)
    display.setColorScheme({ type: 'normal' })
    expect(display.colorBy).toEqual({ type: 'normal' })
  })

  it('an explicit per-track scheme wins over the session default', () => {
    const { session, display } = createDisplay({ colorBy: { type: 'strand' } })
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'colorBy',
      methylation,
    )
    expect(display.colorBy).toEqual({ type: 'strand' })
    expect(display.displayTypeDefaultChanges()).toEqual([])
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
    expect(display.displayTypeDefaultChanges()).toEqual([])
  })

  // Leaving pairs mode discards the now-meaningless pairing scheme by resetting
  // colorBy to the `inherit` sentinel — NOT by customizing `{type:'normal'}`, which
  // (under the sentinel slot) would override a session-wide default. Proven by
  // an active default: after the round-trip the track must FOLLOW it, not sit on
  // a customized normal. A no-default variant would resolve to normal either way and
  // so wouldn't guard the distinction.
  it('leaving pairs resets colorBy so it follows a session default, not customized normal', () => {
    const { session, display } = createDisplay()
    display.setLinkedReads('normal')
    expect(display.colorBy.type).toBe('insertSizeAndOrientation')

    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'colorBy',
      methylation,
    )
    display.setLinkedReads('off')
    expect(display.colorBy).toEqual(methylation)
  })
})

// linkedReads (view-as-pairs) is a sentinel promotable slot: 'inherit' is the
// inherit state (resolving to the session-wide default, else promotedBase
// 'off'), so a track can pin 'off' back over a session-wide 'normal' default —
// which a plain slot could not. getConfResolved never returns 'inherit'.
describe('alignments linkedReads (view as pairs) session default', () => {
  it('resolves to off by default with no config and no session default', () => {
    const { display } = createDisplay()
    expect(display.linkedReads).toBe('off')
    expect(display.pairsDisplayTypeDefault.active).toBe(false)
  })

  it('follows a session-wide normal (pairs) default when not customized', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'linkedReads',
      'normal',
    )
    expect(display.linkedReads).toBe('normal')
    expect(display.pairsDisplayTypeDefault.active).toBe(true)
    expect(display.displayTypeDefaultChanges()).toEqual([
      { path: ['linkedReads'], from: 'off', to: 'normal' },
    ])
  })

  it('a track customized off wins over a session-wide normal default (the sentinel win)', () => {
    const { session, display } = createDisplay({ linkedReads: 'off' })
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'linkedReads',
      'normal',
    )
    // the whole reason for the sentinel: a track explicitly set to 'off' holds
    // off even under a session-wide pairs default, and reads as its own choice
    expect(display.linkedReads).toBe('off')
    expect(display.displayTypeDefaultChanges()).toEqual([])
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

  describe('pairsDisplayTypeDefault', () => {
    it('promotes view-as-pairs as the session default', () => {
      const { session, display } = createDisplay({ linkedReads: 'normal' })
      expect(display.pairsDisplayTypeDefault.active).toBe(false)

      display.pairsDisplayTypeDefault.toggle()
      expect(
        session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'linkedReads'),
      ).toBe('normal')
      expect(display.pairsDisplayTypeDefault.active).toBe(true)
    })

    it('promotes pairs even when this track has them off (per-value)', () => {
      const { session, display } = createDisplay()
      expect(display.linkedReads).toBe('off')
      display.pairsDisplayTypeDefault.toggle()
      expect(
        session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'linkedReads'),
      ).toBe('normal')
      // a not-customized track then follows the promoted default
      expect(display.linkedReads).toBe('normal')
    })

    it('clears the session default when toggled off', () => {
      const { session, display } = createDisplay({ linkedReads: 'normal' })
      display.pairsDisplayTypeDefault.toggle()
      expect(display.pairsDisplayTypeDefault.active).toBe(true)

      display.pairsDisplayTypeDefault.toggle()
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
    expect(display.arcsDisplayTypeDefault.active).toBe(false)
    expect(display.readCloudDisplayTypeDefault.active).toBe(false)
  })

  it('follows a session-wide arc default when not customized', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'readConnections',
      'arc',
    )
    expect(display.readConnections).toBe('arc')
    expect(display.arcsDisplayTypeDefault.active).toBe(true)
    // the read-cloud pin targets a different on-value, so it stays inactive
    expect(display.readCloudDisplayTypeDefault.active).toBe(false)
    expect(display.displayTypeDefaultChanges()).toEqual([
      { path: ['readConnections'], from: 'off', to: 'arc' },
    ])
  })

  it('a track customized off wins over a session-wide arc default', () => {
    const { session, display } = createDisplay({ readConnections: 'off' })
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'readConnections',
      'arc',
    )
    expect(display.readConnections).toBe('off')
    expect(display.displayTypeDefaultChanges()).toEqual([])
  })

  it('the arcs pin promotes arc and clears it (per-value)', () => {
    const { session, display } = createDisplay({ readConnections: 'arc' })
    display.arcsDisplayTypeDefault.toggle()
    expect(
      session.getDisplayTypeDefault(
        'LinearAlignmentsDisplay',
        'readConnections',
      ),
    ).toBe('arc')

    display.arcsDisplayTypeDefault.toggle()
    expect(
      session.getDisplayTypeDefault(
        'LinearAlignmentsDisplay',
        'readConnections',
      ),
    ).toBeUndefined()
  })
})
