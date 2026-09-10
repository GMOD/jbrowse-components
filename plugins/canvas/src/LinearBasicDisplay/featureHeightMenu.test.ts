import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { createTestEnvironment } from './testEnv.ts'

import type { MenuItem } from '@jbrowse/core/ui'

function hasLabel(item: MenuItem, label: string) {
  return 'label' in item && item.label === label
}

function subMenuOf(items: MenuItem[], label: string) {
  const item = items.find(i => hasLabel(i, label))
  if (item && 'subMenu' in item) {
    return resolveSubMenu(item)
  } else {
    throw new Error(`submenu "${label}" not found`)
  }
}

function featureHeightSubMenu(display: { trackMenuItems: () => MenuItem[] }) {
  return subMenuOf(display.trackMenuItems(), 'Set feature height')
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
      'Fixed feature height + fixed track height',
      'Fixed feature height + autogrow track height',
      'Fit feature height to track height',
    ])
    expect(
      subMenu.filter(
        i => i.type === 'subHeader' && hasLabel(i, 'Track sizing'),
      ),
    ).toHaveLength(1)
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
    display.setShowLabels('nameAndDescription')
    expect(display.showLabels).toBe(true)
    expect(display.effectiveShowDescriptions).toBe(true)

    display.setDisplayMode('collapsed')
    expect(display.showLabels).toBe(false)
    expect(display.effectiveShowDescriptions).toBe(false)
    expect(display.showLabelsMode).toBe('nameAndDescription')
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
    expect(
      radio(sizing, 'Fixed feature height + fixed track height').checked,
    ).toBe(true)

    display.setHeightMode('grow')
    const sizing2 = featureHeightSubMenu(display)
    expect(
      radio(sizing2, 'Fixed feature height + autogrow track height').checked,
    ).toBe(true)
    expect(
      radio(sizing2, 'Fixed feature height + fixed track height').checked,
    ).toBe(false)
    expect(display.displayMode).toBe('compact')
    expect(radio(sizing2, 'Compact').checked).toBe(true)
  })
})
