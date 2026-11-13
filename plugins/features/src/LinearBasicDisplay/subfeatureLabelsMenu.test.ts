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

function labelsSubMenu(display: { trackMenuItems: () => MenuItem[] }) {
  return subMenuOf(display.trackMenuItems(), 'Subfeature labels')
}

function radio(subMenu: MenuItem[], label: string) {
  const item = subMenu.find(i => hasLabel(i, label))
  if (item?.type === 'radio') {
    return item
  } else {
    throw new Error(`radio "${label}" not found`)
  }
}

describe('Subfeature labels submenu', () => {
  it('offers Auto/Off/Below/Overlay radios', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const subMenu = labelsSubMenu(display)

    const labels = subMenu.flatMap(i => ('label' in i ? [i.label] : []))
    expect(labels).toEqual(['Auto', 'Off', 'Below', 'Overlay'])
  })

  it('checks the mode the track holds', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    expect(display.subfeatureLabels).toBe('auto')
    expect(radio(labelsSubMenu(display), 'Auto').checked).toBe(true)

    display.setSubfeatureLabels('none')
    expect(radio(labelsSubMenu(display), 'Off').checked).toBe(true)

    display.setSubfeatureLabels('overlay')
    expect(display.subfeatureLabels).toBe('overlay')
    expect(radio(labelsSubMenu(display), 'Overlay').checked).toBe(true)

    display.setSubfeatureLabels('below')
    expect(display.subfeatureLabels).toBe('below')
    const subMenu = labelsSubMenu(display)
    expect(radio(subMenu, 'Below').checked).toBe(true)
    expect(radio(subMenu, 'Overlay').checked).toBe(false)
  })
})
