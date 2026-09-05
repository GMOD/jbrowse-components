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

function showSubMenu(display: { trackMenuItems: () => MenuItem[] }) {
  const items = subMenuOf(display.trackMenuItems(), 'Show...')
  const start = items.findIndex(
    i => i.type === 'subHeader' && i.label === 'Subfeature labels',
  )
  if (start === -1) {
    throw new Error('"Subfeature labels" subHeader not found')
  }
  const rest = items.slice(start + 1)
  const end = rest.findIndex(
    i => i.type === 'subHeader' || i.type === 'divider',
  )
  return end === -1 ? rest : rest.slice(0, end)
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
  it('offers Off/Below/Overlay radios, each carrying a "make default" pin', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const subMenu = showSubMenu(display)

    const labels = subMenu.flatMap(i => ('label' in i ? [i.label] : []))
    expect(labels).toEqual(['Off', 'Below', 'Overlay'])
    expect(radio(subMenu, 'Off').pin).toBeDefined()
    expect(radio(subMenu, 'Below').pin).toBeDefined()
    expect(radio(subMenu, 'Overlay').pin).toBeDefined()
  })

  it('checks the resolved mode and lets a track pin Below back over a session default', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, session } = createDisplay()

    expect(display.subfeatureLabels).toBe('none')
    expect(radio(showSubMenu(display), 'Off').checked).toBe(true)

    session.setDisplayTypeDefault(display.type, 'subfeatureLabels', 'overlay')
    expect(display.subfeatureLabels).toBe('overlay')
    expect(radio(showSubMenu(display), 'Overlay').checked).toBe(true)

    display.setSubfeatureLabels('below')
    expect(display.subfeatureLabels).toBe('below')
    const subMenu = showSubMenu(display)
    expect(radio(subMenu, 'Below').checked).toBe(true)
    expect(radio(subMenu, 'Overlay').checked).toBe(false)
  })
})
