import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// Structural coverage for the "Feature height" submenu: its top level is only
// the three size presets, with the track-height modes nested under "Track
// height". The mutual-exclusion invariants are covered in
// squeezeToDisplayHeight.test.ts; here we assert the menu wires up to them.

function hasLabel(item: MenuItem, label: string) {
  return 'label' in item && item.label === label
}

function subMenuOf(items: MenuItem[], label: string) {
  const item = items.find(i => hasLabel(i, label))
  if (item && 'subMenu' in item) {
    return item.subMenu
  } else {
    throw new Error(`submenu "${label}" not found`)
  }
}

function featureHeightSubMenu(display: { trackMenuItems: () => MenuItem[] }) {
  return subMenuOf(display.trackMenuItems(), 'Feature height')
}

function radio(subMenu: MenuItem[], label: string) {
  const item = subMenu.find(i => hasLabel(i, label))
  if (item?.type === 'radio') {
    return item
  } else {
    throw new Error(`radio "${label}" not found`)
  }
}

describe('Feature height submenu', () => {
  it('top level is only the three size presets plus Track height', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const subMenu = featureHeightSubMenu(display)

    const labels = subMenu.flatMap(i => ('label' in i ? [i.label] : []))
    expect(labels).toEqual([
      'Normal',
      'Compact',
      'Super-compact',
      'Track height',
    ])
    // no subheaders; each size preset carries a "make default" pin
    expect(subMenu.some(i => i.type === 'subHeader')).toBe(false)
    expect(radio(subMenu, 'Normal').endAdornment).toBeDefined()
    expect(radio(subMenu, 'Compact').endAdornment).toBeDefined()
    expect(radio(subMenu, 'Super-compact').endAdornment).toBeDefined()
  })

  it('resolves the session-wide default and lets a track pin any preset back', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, session } = createDisplay()

    // un-pinned track (displayMode at the `inherit` sentinel) resolves to normal
    expect(display.displayMode).toBe('normal')

    // promoting Compact as the display-type default flows through the resolved
    // getter without the track pinning its own value
    session.setDisplayTypeDefault(display.type, 'displayMode', 'compact')
    expect(display.displayMode).toBe('compact')

    // the track can still pin Normal back over the Compact session default —
    // the sentinel default is what makes `normal` distinguishable from unset
    display.setDisplayMode('normal')
    expect(display.displayMode).toBe('normal')
  })

  it('checks the resolved size preset', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    expect(radio(featureHeightSubMenu(display), 'Normal').checked).toBe(true)

    display.setDisplayMode('compact')
    const subMenu = featureHeightSubMenu(display)
    expect(radio(subMenu, 'Normal').checked).toBe(false)
    expect(radio(subMenu, 'Compact').checked).toBe(true)
  })

  it('Track height submenu holds only the track-height radios, tracking heightMode', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setDisplayMode('compact')
    const advanced = subMenuOf(featureHeightSubMenu(display), 'Track height')

    // exactly the three track-height modes, no default-promotion controls
    const labels = advanced.flatMap(i => ('label' in i ? [i.label] : []))
    expect(labels).toEqual([
      'Fixed height — scroll to see all features',
      'Auto height — grow track to show all features',
      'Fixed height — compress features to fit',
    ])
    expect(advanced.some(i => i.type === 'checkbox')).toBe(false)
    expect(
      radio(advanced, 'Fixed height — scroll to see all features').checked,
    ).toBe(true)

    display.setHeightMode('grow')
    const advanced2 = subMenuOf(featureHeightSubMenu(display), 'Track height')
    expect(
      radio(advanced2, 'Auto height — grow track to show all features')
        .checked,
    ).toBe(true)
    expect(
      radio(advanced2, 'Fixed height — scroll to see all features').checked,
    ).toBe(false)
    // density is orthogonal — still Compact while the track grows
    // (verified via the model getter; the size radios live one level up)
    expect(display.displayMode).toBe('compact')
  })
})
