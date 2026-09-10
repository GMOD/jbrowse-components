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
    i => i.type === 'subHeader' && i.label === 'Labels',
  )
  if (start === -1) {
    throw new Error('"Labels" subHeader not found')
  }
  const rest = items.slice(start + 1)
  const end = rest.findIndex(
    i => i.type === 'subHeader' || i.type === 'divider',
  )
  return end === -1 ? rest : rest.slice(0, end)
}

function labelsOf(subMenu: MenuItem[]) {
  return subMenu.flatMap(i =>
    'label' in i && typeof i.label === 'string' ? [i.label] : [],
  )
}

function radio(subMenu: MenuItem[], label: string) {
  const item = subMenu.find(i => hasLabel(i, label))
  if (item?.type === 'radio') {
    return item
  } else {
    throw new Error(`radio "${label}" not found`)
  }
}

describe('Labels submenu', () => {
  it('offers every rung', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const subMenu = showSubMenu(display)

    const labels = labelsOf(subMenu)
    expect(labels).toEqual([
      'Auto',
      'Name + description',
      'Name only',
      'Description only',
      'None',
    ])
  })

  it('checks the rung the track holds', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()

    expect(display.showLabelsMode).toBe('auto')
    expect(radio(showSubMenu(display), 'Auto').checked).toBe(true)

    display.setShowLabels('none')
    expect(display.showLabelsMode).toBe('none')
    expect(radio(showSubMenu(display), 'None').checked).toBe(true)
    expect(display.showLabels).toBe(false)
    expect(display.showDescriptions).toBe(false)

    display.setShowLabels('auto')
    expect(display.showLabelsMode).toBe('auto')
    expect(radio(showSubMenu(display), 'Auto').checked).toBe(true)
  })
})
