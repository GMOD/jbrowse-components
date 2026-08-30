import { getConf } from '@jbrowse/core/configuration'
import { takeSnackbarAction } from '@jbrowse/display-test-utils'

import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// The LD color key labels the r² ramp the points are painted against. It was a
// VOLATILE until it became a promotable config slot — sitting with
// `hoveredFeature` and `rpcDataMap`, so it reset on every retick and turning
// the key off lasted only until the track was hidden and reshown. These pin the
// two halves of that change: it persists, and it cascades.
//
// `colorBy: 'ld'` throughout, since the row is disabled (though still present,
// and still pinned) under the plain single-color scheme.

function ldLegendRow(items: MenuItem[]) {
  const walk = (list: MenuItem[]): MenuItem[] =>
    list.flatMap(i => ('subMenu' in i ? walk(i.subMenu) : [i]))
  return walk(items).find(i => 'label' in i && i.label === 'Show legend')
}

describe('Manhattan showLdLegend', () => {
  it('is on by default, from promotedBase rather than a volatile initializer', () => {
    const { display } = createTestEnvironment({ colorBy: 'ld' }).createDisplay()
    expect(display.showLdLegend).toBe(true)
    expect(display.showLdLegendDisplayTypeDefault.active).toBe(false)
  })

  // The whole point of the volatile -> config move. A volatile write was lost
  // on the next retick; a config write lands on the display's config node,
  // which outlives the display instance.
  it('an explicit off is written to the config node, so it survives a retick', () => {
    const { display } = createTestEnvironment({ colorBy: 'ld' }).createDisplay()
    display.setShowLdLegend(false)

    expect(display.showLdLegend).toBe(false)
    // the RAW stored value: `getConf` never walks the cascade, so this is what
    // the config node itself holds rather than what the display resolved to
    expect(getConf(display, 'showLdLegend')).toBe(false)
  })

  it('follows a session-wide default of off when the track is not customized', () => {
    const { session, display } = createTestEnvironment({
      colorBy: 'ld',
    }).createDisplay()
    session.setDisplayTypeDefault(
      'LinearManhattanDisplay',
      'showLdLegend',
      false,
    )
    expect(display.showLdLegend).toBe(false)
    expect(display.showLdLegendDisplayTypeDefault.active).toBe(true)
  })

  // A `maybeBoolean` sentinel slot, so an explicit value wins in EITHER
  // direction — including turning the key back on over a session default of
  // off, which a plain boolean could not express (`true` would read as the
  // un-set default and re-inherit).
  it('a track can turn it back on over an off session default', () => {
    const { session, display } = createTestEnvironment({
      colorBy: 'ld',
    }).createDisplay()
    session.setDisplayTypeDefault(
      'LinearManhattanDisplay',
      'showLdLegend',
      false,
    )
    expect(display.showLdLegend).toBe(false)

    display.setShowLdLegend(true)
    expect(display.showLdLegend).toBe(true)
  })

  it('ignores a non-boolean session default', () => {
    const { session, display } = createTestEnvironment({
      colorBy: 'ld',
    }).createDisplay()
    session.setDisplayTypeDefault(
      'LinearManhattanDisplay',
      'showLdLegend',
      'yes',
    )
    expect(display.showLdLegend).toBe(true)
  })

  // The pin's click applies the value to the open tracks; the toast's one
  // action is what makes it the display type's default (ADR-048).
  it('the menu row carries the pin, and it promotes the current value', () => {
    const { session, display } = createTestEnvironment({
      colorBy: 'ld',
    }).createDisplay()
    display.setShowLdLegend(false)
    const row = ldLegendRow(display.trackMenuItems())
    expect(row && 'pin' in row ? row.pin : undefined).toBeDefined()

    display.showLdLegendDisplayTypeDefault.toggle()
    takeSnackbarAction(session)
    expect(
      session.getDisplayTypeDefault('LinearManhattanDisplay', 'showLdLegend'),
    ).toBe(false)
  })

  // The row is greyed out without LD coloring, but it is still built and still
  // pinned — PromotablePinCoverage walks the menu in the default `colorBy:
  // 'normal'` state, so a pin only present under 'ld' would read as missing.
  it('still offers the pinned row under the plain color scheme, disabled', () => {
    const { display } = createTestEnvironment().createDisplay()
    const row = ldLegendRow(display.trackMenuItems())
    expect(row && 'disabled' in row ? row.disabled : undefined).toBe(true)
    expect(row && 'pin' in row ? row.pin : undefined).toBeDefined()
  })
})
