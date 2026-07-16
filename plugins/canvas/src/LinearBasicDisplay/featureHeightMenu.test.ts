import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

// Structural coverage for the single "Feature height" menu, mirroring the
// alignments display: the three size presets, then a "Track sizing" subheader,
// then the scroll/expand/squeeze modes. The mutual-exclusion invariants are
// covered in squeezeToDisplayHeight.test.ts; here we assert the menu wires up
// to them.

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
  it('holds the size presets, then a Track sizing subheader, then the modes', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const subMenu = featureHeightSubMenu(display)

    const labels = subMenu.flatMap(i =>
      'label' in i && i.type !== 'subHeader' ? [i.label] : [],
    )
    expect(labels).toEqual([
      'Normal',
      'Compact',
      'Super-compact',
      'Collapsed',
      'Fixed feature height',
      'Fixed feature height + autogrow track height',
      'Fit feature height to display',
    ])
    // one "Track sizing" subheader separates the two radio groups
    expect(
      subMenu.filter(
        i => i.type === 'subHeader' && hasLabel(i, 'Track sizing'),
      ),
    ).toHaveLength(1)
    // each size preset carries a "make default" pin
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

  it('collapsed suppresses names + descriptions without clobbering the settings', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setShowLabels('on')
    display.setShowDescriptions(true)
    expect(display.showLabels).toBe(true)
    expect(display.effectiveShowDescriptions).toBe(true)

    display.setDisplayMode('collapsed')
    // both label kinds are forced off for the single-row overview
    expect(display.showLabels).toBe(false)
    expect(display.effectiveShowDescriptions).toBe(false)
    // ...but the persisted settings are untouched, so the "Show descriptions"
    // menu checkbox still reflects the user's choice (gated at the render layer,
    // not the raw getter) and returns on leaving collapsed
    expect(display.showDescriptions).toBe(true)
    display.setDisplayMode('normal')
    expect(display.showLabels).toBe(true)
    expect(display.effectiveShowDescriptions).toBe(true)
  })

  it('the track-sizing radios track heightMode, orthogonal to the size presets', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setDisplayMode('compact')
    const sizing = featureHeightSubMenu(display)

    expect(sizing.some(i => i.type === 'checkbox')).toBe(false)
    expect(radio(sizing, 'Fixed feature height').checked).toBe(true)
    // each mode carries a "make default" pin, like the size presets
    expect(radio(sizing, 'Fixed feature height').endAdornment).toBeDefined()
    expect(
      radio(sizing, 'Fixed feature height + autogrow track height')
        .endAdornment,
    ).toBeDefined()
    expect(
      radio(sizing, 'Fit feature height to display').endAdornment,
    ).toBeDefined()

    display.setHeightMode('grow')
    const sizing2 = featureHeightSubMenu(display)
    expect(
      radio(sizing2, 'Fixed feature height + autogrow track height').checked,
    ).toBe(true)
    expect(radio(sizing2, 'Fixed feature height').checked).toBe(false)
    // density is orthogonal — still Compact while the track grows
    expect(display.displayMode).toBe('compact')
    // and the size presets still read as Compact in the same menu
    expect(radio(sizing2, 'Compact').checked).toBe(true)
  })
})
