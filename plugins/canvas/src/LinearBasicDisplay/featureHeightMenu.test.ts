import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// Structural coverage for the two sibling height menus: "Feature height" holds
// only the three size presets, and "Track sizing" (its own top-level entry, not
// nested) holds the scroll/expand/squeeze modes. The mutual-exclusion
// invariants are covered in squeezeToDisplayHeight.test.ts; here we assert the
// menu wires up to them.

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

function trackSizingSubMenu(display: { trackMenuItems: () => MenuItem[] }) {
  return subMenuOf(display.trackMenuItems(), 'Track sizing')
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
  it('top level is only the three size presets', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const subMenu = featureHeightSubMenu(display)

    const labels = subMenu.flatMap(i => ('label' in i ? [i.label] : []))
    expect(labels).toEqual(['Normal', 'Compact', 'Super-compact'])
    // no subheaders; each size preset carries a "make default" pin
    expect(subMenu.some(i => i.type === 'subHeader')).toBe(false)
    expect(radio(subMenu, 'Normal').endAdornment).toBeDefined()
    expect(radio(subMenu, 'Compact').endAdornment).toBeDefined()
    expect(radio(subMenu, 'Super-compact').endAdornment).toBeDefined()
  })

  it('resolves the session-wide default and lets a track pin any preset back', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, session } = createDisplay()

    // a track following the default (displayMode at the `inherit` sentinel) resolves to normal
    expect(display.displayMode).toBe('normal')

    // promoting Compact as the display-type default flows through the resolved
    // getter without the track customizing its own value
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

  it('Track sizing submenu holds only the track-sizing radios, tracking heightMode', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setDisplayMode('compact')
    const sizing = trackSizingSubMenu(display)

    // exactly the three track-sizing modes, each a radio carrying its own pin
    const labels = sizing.flatMap(i => ('label' in i ? [i.label] : []))
    expect(labels).toEqual([
      'Scroll to see all features',
      'Expand to fit all features',
      'Squeeze all features into view',
    ])
    expect(sizing.some(i => i.type === 'checkbox')).toBe(false)
    expect(radio(sizing, 'Scroll to see all features').checked).toBe(true)
    // each mode carries a "make default" pin, like the size presets
    expect(
      radio(sizing, 'Scroll to see all features').endAdornment,
    ).toBeDefined()
    expect(
      radio(sizing, 'Expand to fit all features').endAdornment,
    ).toBeDefined()
    expect(
      radio(sizing, 'Squeeze all features into view').endAdornment,
    ).toBeDefined()

    display.setHeightMode('grow')
    const sizing2 = trackSizingSubMenu(display)
    expect(radio(sizing2, 'Expand to fit all features').checked).toBe(true)
    expect(radio(sizing2, 'Scroll to see all features').checked).toBe(false)
    // density is orthogonal — still Compact while the track grows
    // (verified via the model getter; the size radios live in a sibling menu)
    expect(display.displayMode).toBe('compact')
  })
})
