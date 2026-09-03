import {
  clearPromotedDefaults,
  getDisplayTypeDefaultChanges,
} from '@jbrowse/core/configuration'

import { getFeatureHeightMenuItem } from './menus/featureSize.ts'
import {
  bootAlignmentsDisplay,
  clickMenuItem,
  findMenuItem,
  menuSubItems,
} from './testUtils.ts'

// Boots a real LinearAlignmentsDisplay so the showSoftClipping resolution and
// the promote/clear actions run against the actual MST model. `baseSession`
// backs get/setDisplayTypeDefault with the same nested-object store BaseSession
// uses (round-trip-tested in sessionModelFactory.test.ts); here we exercise how
// the display reads it. showSoftClipping is a promotable `maybeBoolean` slot,
// resolved through getConf (track pin -> session default -> off).
//
// `displayConfig` lands on the track's own display config (`displayId: 'd1'`),
// which the view-level display then references — that indirection is how a
// case states the TRACK's pinned value, as opposed to the session default it is
// resolved against.
function createDisplay(displayConfig: Record<string, unknown> = {}) {
  console.warn = jest.fn()
  const { baseSession, mount } = bootAlignmentsDisplay({
    trackConfig: {
      displays: [
        { type: 'LinearAlignmentsDisplay', displayId: 'd1', ...displayConfig },
      ],
    },
  })
  // no `call`: nothing here is meant to reach a fetch, so one would throw
  const Session = baseSession
    .volatile(() => ({
      rpcManager: {},
      lastActions: [] as SnackActionShim[],
    }))
    .actions(self => ({
      notify(
        _message: string,
        _level?: string,
        action?: SnackActionShim | SnackActionShim[],
      ) {
        self.lastActions = action
          ? Array.isArray(action)
            ? action
            : [action]
          : []
      },
    }))
  const { session, display } = mount(Session, { configuration: 'd1' })
  return { session, display }
}

interface SnackActionShim {
  name: string
  onClick: () => void
}

// A pin's click applies its value to the open tracks and offers the display-type
// default as the toast's one action. Promoting is that second click, never the
// first, so every assertion about `getDisplayTypeDefault` goes through here.
function promote(session: ReturnType<typeof createDisplay>['session']) {
  const found = session.lastActions.find(a => a.name === 'Set as the default')
  if (!found) {
    throw new Error('the pin raised no "Set as the default" action')
  }
  found.onClick()
}

// The grow/fit radios live in the same merged "Read height" menu as the fixed
// size presets (one mutually-exclusive group), below a divider. Module-level so
// tests in every describe block can reach them.
function heightModePinProps(
  display: ReturnType<typeof createDisplay>['display'],
  label: string,
) {
  const sub = getFeatureHeightMenuItem(display, 'read').subMenu
  const row = sub.find(i => 'label' in i && i.label === label)
  // a description (`{ ...pin, label }`), not a rendered element — ui/MenuTypes.ts
  return row && 'pin' in row ? row.pin : undefined
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
    expect(getDisplayTypeDefaultChanges(display)).toEqual([
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
    expect(getDisplayTypeDefaultChanges(display)).toEqual([])
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
      promote(session)
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
      promote(session)
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

    clearPromotedDefaults(display, ['showSoftClipping'])
    expect(
      session.getDisplayTypeDefault(
        'LinearAlignmentsDisplay',
        'showSoftClipping',
      ),
    ).toBeUndefined()
    expect(display.showSoftClipping).toBe(false)
    expect(getDisplayTypeDefaultChanges(display)).toEqual([])
  })
})

// Compactness is the featureHeight + heightMode promotable slots (spacing is
// derived from height, not stored). Each resolves independently through
// getConf (same rule as showSoftClipping): a slot at its schema default
// follows the session-wide default; any other value pins it. heightMode='fixed'
// equals its promotedBase, so it never shows up as a displayTypeDefaultChanges
// diff. The menu's per-preset pins that promote these values are exercised below.
const setCompact = (session: {
  setDisplayTypeDefault: (t: string, s: string, v: unknown) => void
}) => {
  session.setDisplayTypeDefault('LinearAlignmentsDisplay', 'featureHeight', 3)
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
    // spacing is derived from the resolved height (3 -> 0)
    expect(display.featureSpacing).toBe(0)
    expect(getDisplayTypeDefaultChanges(display)).toEqual([
      { path: ['featureHeight'], from: 7, to: 3 },
    ])
  })

  it('an explicit per-track size wins over the session default', () => {
    const { session, display } = createDisplay({
      featureHeight: 3,
    })
    session.setDisplayTypeDefault('LinearAlignmentsDisplay', 'featureHeight', 1)
    // customized regardless of the (super-compact) session default
    expect(display.featureHeight).toBe(3)
    expect(getDisplayTypeDefaultChanges(display)).toEqual([])
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

    clearPromotedDefaults(display, ['featureHeight', 'showSoftClipping'])
    expect(display.featureHeight).toBe(7)
    expect(display.showSoftClipping).toBe(false)
    expect(getDisplayTypeDefaultChanges(display)).toEqual([])
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
    expect(getDisplayTypeDefaultChanges(display)).toEqual([
      { path: ['featureHeight'], from: 7, to: 3 },
      { path: ['showSoftClipping'], from: false, to: true },
    ])
  })
})

// The "Read height" submenu surfaces the promote-as-default control as
// a per-preset pin (pin) on each value row — not the former standalone
// "Use X as the default" checkbox. Each pin's isDefault/onToggleDefault is
// independent, so only the promoted preset reads as customized.
describe('feature-height menu per-preset pins', () => {
  function pinProps(
    display: ReturnType<typeof createDisplay>['display'],
    label: string,
  ) {
    const row = getFeatureHeightMenuItem(display, 'read').subMenu.find(
      i => 'label' in i && i.label === label,
    )
    return row && 'pin' in row ? row.pin : undefined
  }

  it('has no standalone "as the default" checkbox row', () => {
    const { display } = createDisplay()
    expect(
      getFeatureHeightMenuItem(display, 'read').subMenu.some(
        i => 'label' in i && String(i.label).includes('as the default'),
      ),
    ).toBe(false)
  })

  it('gives every size preset its own pin', () => {
    const { display } = createDisplay()
    for (const label of ['Normal', 'Compact', 'Super-compact']) {
      expect(pinProps(display, label)).toBeDefined()
    }
  })

  it('gives every track-sizing mode its own pin', () => {
    const { display } = createDisplay()
    for (const label of [
      'Fixed read height + fixed track height',
      'Fixed read height + autogrow track height',
      'Fit read height to track height',
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
      heightModePinProps(display, 'Fit read height to track height')?.control
        .active,
    ).toBe(false)
    expect(
      heightModePinProps(display, 'Fixed read height + autogrow track height')
        ?.control.active,
    ).toBe(false)
  })

  it("clicking a preset's pin promotes that exact preset", () => {
    const { session, display } = createDisplay()
    pinProps(display, 'Compact')?.control.toggle()
    promote(session)
    expect(
      session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'featureHeight'),
    ).toBe(3)
    expect(pinProps(display, 'Compact')?.control.active).toBe(true)
  })

  it("clicking a preset's pin overwrites the clicked track's own height", () => {
    // a track customized to a taller height. The pin's click applies its value
    // to every open track of the type, customized ones included — there is no
    // separate "override" step, because overwriting a customized track is the
    // same write as filling in a follower (ADR-048).
    const { display } = createDisplay({ featureHeight: 12 })
    expect(display.featureHeight).toBe(12)

    pinProps(display, 'Compact')?.control.toggle()

    expect(display.configuredFeatureHeight).toBe(3)
    expect(display.featureHeight).toBe(3)
  })

  it('a track following the default is written too, not left to resolve', () => {
    // the other half of the same rule: a follower is showing its value only by
    // way of whatever default is in place, so the click writes it as well
    const { display } = createDisplay()
    expect(display.featureHeight).toBe(7)

    pinProps(display, 'Compact')?.control.toggle()

    expect(display.configuredFeatureHeight).toBe(3)
    expect(display.featureHeight).toBe(3)
  })

  function presetRow(
    display: ReturnType<typeof createDisplay>['display'],
    label: string,
  ) {
    const row = getFeatureHeightMenuItem(display, 'read').subMenu.find(
      i => 'label' in i && i.label === label,
    )
    return row as { checked?: boolean; onClick?: () => void } | undefined
  }

  it('clicking Normal overrides a Compact session default (#regression)', () => {
    // Normal's height (7) is the schema base; when featureHeight was a plain
    // number slot, clicking Normal stripped to default and re-inherited the
    // Compact default, so Normal could never be selected. The sentinel
    // maybeNumber slot lets the real value 7 win over the session default.
    const { session, display } = createDisplay()
    setCompact(session)
    expect(display.featureHeight).toBe(3)
    expect(presetRow(display, 'Compact')?.checked).toBe(true)
    expect(presetRow(display, 'Normal')?.checked).toBe(false)

    presetRow(display, 'Normal')?.onClick?.()

    expect(display.featureHeight).toBe(7)
    expect(display.featureSpacing).toBe(1)
    expect(presetRow(display, 'Normal')?.checked).toBe(true)
    expect(presetRow(display, 'Compact')?.checked).toBe(false)
  })

  it('a track that clicked Normal stays Normal when a Compact default is set later', () => {
    // Clicking a preset customizes the track (writes explicit 7/1), so a
    // subsequently-promoted Compact default does not move it — the same
    // per-track-wins semantics every other sentinel slot has.
    const { session, display } = createDisplay()
    presetRow(display, 'Normal')?.onClick?.()
    expect(display.featureHeight).toBe(7)

    setCompact(session)
    expect(display.featureHeight).toBe(7)
    expect(display.featureSpacing).toBe(1)
    expect(presetRow(display, 'Normal')?.checked).toBe(true)
    // it holds its own value, so it is not flagged as merely following the default
    expect(getDisplayTypeDefaultChanges(display)).toEqual([])
  })

  it('clicking Super-compact then Normal lands on Normal over a Compact default', () => {
    // exercises the value-not-equal-to-any-default path too
    const { session, display } = createDisplay()
    setCompact(session)
    presetRow(display, 'Super-compact')?.onClick?.()
    expect(display.featureHeight).toBe(1)
    expect(presetRow(display, 'Super-compact')?.checked).toBe(true)

    presetRow(display, 'Normal')?.onClick?.()
    expect(display.featureHeight).toBe(7)
    expect(display.featureSpacing).toBe(1)
    expect(presetRow(display, 'Normal')?.checked).toBe(true)
  })

  it("the fit pin promotes heightMode='fit'", () => {
    const { session, display } = createDisplay()
    heightModePinProps(
      display,
      'Fit read height to track height',
    )?.control.toggle()
    promote(session)
    expect(
      session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'heightMode'),
    ).toBe('fit')
  })
})

// Fit-to-display-height is the `heightMode` sentinel promotable slot
// ('inherit' | 'fit' | 'fixed', promotedBase 'fixed'). It rides the same
// "make default" grouping as featureHeight so promoting a fit track persists
// fit — not a frozen pixel size. Being a sentinel lets a track
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

  it('picking a size exits fit to fixed, even over a promoted fit default', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'heightMode',
      'fit',
    )
    expect(display.fitHeightToDisplay).toBe(true)

    display.setFeatureHeight(3)
    // fit derives the size, so a chosen size drops back to fixed and takes effect
    expect(display.fitHeightToDisplay).toBe(false)
    expect(display.heightMode).toBe('fixed')
    expect(display.configuredFeatureHeight).toBe(3)
  })

  it('setFeatureHeight exits fit mode', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    expect(display.fitHeightToDisplay).toBe(true)

    display.setFeatureHeight(20)
    expect(display.fitHeightToDisplay).toBe(false)
    expect(display.configuredFeatureHeight).toBe(20)
  })

  // The "Set feature height" dialog edits the fixed config, so it must seed from
  // `configuredFeatureHeight` — the resolved `featureHeight` becomes the
  // fractional fit pitch in Compressed mode, which the dialog would then bake.
  it('exposes configured feature size independent of the fit squeeze', () => {
    const { display } = createDisplay()
    display.setHeightMode('fit')
    display.setFittedHeightPx(4)

    // resolved size follows the fit pitch (4px pitch = 3px body + 1px spacing)
    expect(display.featureHeight).toBe(3)
    expect(display.featureSpacing).toBe(1)

    // ...but the configured size the dialog edits stays at the config base
    expect(display.configuredFeatureHeight).toBe(7)
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
// promotable `maybeBoolean` slot: resolved through getConf (track pin →
// session default → off), reaches the renderers via renderState (tier-4
// rerender), and an explicit off can be customized over an on session default.
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

  it('the pin promotes on as the session default, from an unchecked row too', () => {
    const { session, display } = createDisplay()
    display.setMismatchAlpha(false)
    display.mismatchAlphaDisplayTypeDefault.toggle()
    expect(display.mismatchAlpha).toBe(true)
    promote(session)
    expect(
      session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'mismatchAlpha'),
    ).toBe(true)
  })

  it('the top-level Show menu exposes the fade-by-quality toggle', () => {
    const { display } = createDisplay()
    // Top-level Show item, not nested under Advanced.
    const show = menuSubItems(display.trackMenuItems(), 'Show...')
    clickMenuItem(show, 'Fade low quality mismatches')
    expect(display.mismatchAlpha).toBe(true)
  })
})

// showSashimiLabels draws the supporting-read count on each sashimi arc. A
// promotable `maybeBoolean` slot (like mismatchAlpha), so an explicit off is a
// real pin rather than the un-set sentinel and survives an on session default.
describe('alignments showSashimiLabels (sashimi arc counts)', () => {
  it('is off by default with no config and no session default', () => {
    const { display } = createDisplay()
    expect(display.showSashimiLabels).toBe(false)
    expect(display.showSashimiLabelsDisplayTypeDefault.active).toBe(false)
  })

  it('follows a session-wide default of on when the track is not customized', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'showSashimiLabels',
      true,
    )
    expect(display.showSashimiLabels).toBe(true)
    expect(getDisplayTypeDefaultChanges(display)).toEqual([
      { path: ['showSashimiLabels'], from: false, to: true },
    ])
  })

  it('a track can pin off over an on session default (#regression)', () => {
    // When this was a plain `boolean` with defaultValue false, an explicit off
    // was indistinguishable from the un-set default: stripDefault dropped it,
    // the slot read as "inherit", and the promoted `true` came straight back —
    // so the menu checkbox could not be unticked at all.
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'showSashimiLabels',
      true,
    )
    expect(display.showSashimiLabels).toBe(true)

    display.setShowSashimiLabels(false)
    expect(display.showSashimiLabels).toBe(false)
    // holding its own value, it is not merely following the default
    expect(getDisplayTypeDefaultChanges(display)).toEqual([])
  })

  it('the pin turns labels on, from an unchecked row too', () => {
    const { session, display } = createDisplay()
    display.setShowSashimiLabels(false)
    display.showSashimiLabelsDisplayTypeDefault.toggle()
    expect(display.showSashimiLabels).toBe(true)
    promote(session)
    expect(
      session.getDisplayTypeDefault(
        'LinearAlignmentsDisplay',
        'showSashimiLabels',
      ),
    ).toBe(true)
    expect(display.showSashimiLabelsDisplayTypeDefault.active).toBe(true)
  })

  it('ignores a non-boolean session default', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'showSashimiLabels',
      'yes',
    )
    expect(display.showSashimiLabels).toBe(false)
  })
})

// showLegend draws the floating color-scheme key. A promotable `maybeBoolean`
// slot in six schemas (see DISPLAY_TYPE_DEFAULTS.md) — this exercises the
// alignments one, which is also LGVSyntenyDisplay's by inheritance.
describe('alignments showLegend (color-scheme key)', () => {
  it('is off by default with no config and no session default', () => {
    const { display } = createDisplay()
    expect(display.showLegend).toBe(false)
    expect(display.showLegendDisplayTypeDefault.active).toBe(false)
  })

  it('follows a session-wide default of on when the track is not customized', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault('LinearAlignmentsDisplay', 'showLegend', true)
    expect(display.showLegend).toBe(true)
    expect(display.showLegendDisplayTypeDefault.active).toBe(true)
    expect(getDisplayTypeDefaultChanges(display)).toEqual([
      { path: ['showLegend'], from: false, to: true },
    ])
  })

  // The legend's own "×" is `setShowLegend(false)` (PileupComponent), so under
  // a promoted "on" it has to be a real customization rather than the un-set
  // sentinel — otherwise dismissing the key on one track would put it straight
  // back, which is exactly what a plain boolean would have done.
  it('the legend "×" turns it off on one track under an on session default', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault('LinearAlignmentsDisplay', 'showLegend', true)
    expect(display.showLegend).toBe(true)

    display.setShowLegend(false)
    expect(display.showLegend).toBe(false)
    // holding its own value, it is not merely following the default
    expect(getDisplayTypeDefaultChanges(display)).toEqual([])
  })

  it('the pin shows the legend, from an unchecked row too', () => {
    const { session, display } = createDisplay()
    display.setShowLegend(false)
    display.showLegendDisplayTypeDefault.toggle()
    expect(display.showLegend).toBe(true)
    promote(session)
    expect(
      session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'showLegend'),
    ).toBe(true)
    expect(display.showLegendDisplayTypeDefault.active).toBe(true)
  })

  it('ignores a non-boolean session default', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'showLegend',
      'yes',
    )
    expect(display.showLegend).toBe(false)
  })

  it('the Show menu row carries the pin', () => {
    const { session, display } = createDisplay()
    const row = findMenuItem(
      menuSubItems(display.trackMenuItems(), 'Show...'),
      'Show legend',
    )
    expect(row?.pin).toBeDefined()

    row?.pin?.control.toggle()
    promote(session)
    expect(
      session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'showLegend'),
    ).toBe(true)
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

  it('picking a size keeps grow mode (grows at the new size)', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'heightMode',
      'grow',
    )
    expect(display.autoHeight).toBe(true)

    display.setFeatureHeight(3)
    expect(display.autoHeight).toBe(true)
    expect(display.configuredFeatureHeight).toBe(3)
  })

  it("the grow pin promotes heightMode='grow'", () => {
    const { session, display } = createDisplay()
    heightModePinProps(
      display,
      'Fixed read height + autogrow track height',
    )?.control.toggle()
    promote(session)
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
  const mappingQuality = { type: 'mappingQuality' }

  it('resolves to normal by default with no config and no session default', () => {
    const { display } = createDisplay()
    expect(display.colorBy).toEqual({ type: 'normal' })
  })

  it('follows a session-wide scheme when the track is not customized', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'colorBy',
      mappingQuality,
    )
    expect(display.colorBy).toEqual(mappingQuality)
    expect(getDisplayTypeDefaultChanges(display)).toEqual([
      { path: ['colorBy'], from: { type: 'normal' }, to: mappingQuality },
    ])
  })

  it('a track customized to normal wins over an opposite session default', () => {
    const { session, display } = createDisplay({ colorBy: { type: 'normal' } })
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'colorBy',
      mappingQuality,
    )
    // sentinel slot: `{type:'normal'}` differs from the `{type:'inherit'}`
    // default, so it customizes the track — normal is forced over the mappingQuality
    // default (impossible with the old plain-default slot). Not an inherited
    // change, so displayTypeDefaultChanges is empty.
    expect(display.colorBy).toEqual({ type: 'normal' })
    expect(getDisplayTypeDefaultChanges(display)).toEqual([])
  })

  it('setColorScheme(normal) pins normal over an opposite session default', () => {
    const { session, display } = createDisplay()
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'colorBy',
      mappingQuality,
    )
    expect(display.colorBy).toEqual(mappingQuality)
    display.setColorScheme({ type: 'normal' })
    expect(display.colorBy).toEqual({ type: 'normal' })
  })

  it('an explicit per-track scheme wins over the session default', () => {
    const { session, display } = createDisplay({ colorBy: { type: 'strand' } })
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'colorBy',
      mappingQuality,
    )
    expect(display.colorBy).toEqual({ type: 'strand' })
    expect(getDisplayTypeDefaultChanges(display)).toEqual([])
  })

  it('reacts to the session default changing after creation', () => {
    const { session, display } = createDisplay()
    expect(display.colorBy).toEqual({ type: 'normal' })
    session.setDisplayTypeDefault(
      'LinearAlignmentsDisplay',
      'colorBy',
      mappingQuality,
    )
    expect(display.colorBy).toEqual(mappingQuality)
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
      'mappingQuality',
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
    expect(getDisplayTypeDefaultChanges(display)).toEqual([])
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
      mappingQuality,
    )
    display.setLinkedReads('off')
    expect(display.colorBy).toEqual(mappingQuality)
  })
})

// linkedReads (view-as-pairs) is a sentinel promotable slot: being unset is the
// inherit state (resolving to the session-wide default, else promotedBase
// 'off'), so a track can pin 'off' back over a session-wide 'normal' default —
// which a plain slot could not. resolveConf never returns the sentinel.
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
    expect(getDisplayTypeDefaultChanges(display)).toEqual([
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
    expect(getDisplayTypeDefaultChanges(display)).toEqual([])
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
      promote(session)
      expect(
        session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'linkedReads'),
      ).toBe('normal')
      expect(display.pairsDisplayTypeDefault.active).toBe(true)
    })

    it('promotes pairs even when this track has them off (per-value)', () => {
      const { session, display } = createDisplay()
      expect(display.linkedReads).toBe('off')
      display.pairsDisplayTypeDefault.toggle()
      promote(session)
      expect(
        session.getDisplayTypeDefault('LinearAlignmentsDisplay', 'linkedReads'),
      ).toBe('normal')
      // the click wrote the track, so it shows pairs either way
      expect(display.linkedReads).toBe('normal')
    })

    it('clears the session default when toggled off', () => {
      const { session, display } = createDisplay({ linkedReads: 'normal' })
      display.pairsDisplayTypeDefault.toggle()
      promote(session)
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
    expect(getDisplayTypeDefaultChanges(display)).toEqual([
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
    expect(getDisplayTypeDefaultChanges(display)).toEqual([])
  })

  it('the arcs pin promotes arc and clears it (per-value)', () => {
    const { session, display } = createDisplay({ readConnections: 'arc' })
    display.arcsDisplayTypeDefault.toggle()
    promote(session)
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
