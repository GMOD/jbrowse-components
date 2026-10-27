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

function checkbox(
  display: { trackMenuItems: () => MenuItem[] },
  label: string,
) {
  const item = subMenuOf(display.trackMenuItems(), 'Show').find(i =>
    hasLabel(i, label),
  )
  if (item?.type === 'checkbox') {
    return item
  } else {
    throw new Error(`checkbox "${label}" not found`)
  }
}

describe('Show... label checkboxes', () => {
  it('checks each label the track shows', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    expect(checkbox(display, 'Names').checked).toBe(true)
    expect(checkbox(display, 'Descriptions').checked).toBe(true)

    display.setShowDescriptions(false)
    expect(checkbox(display, 'Names').checked).toBe(true)
    expect(checkbox(display, 'Descriptions').checked).toBe(false)
    expect(display.effectiveShowDescriptions).toBe(false)
  })

  it('writes the two shows independently', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    display.setShowNames(false)
    expect(display.showLabels).toBe(false)
    expect(display.showDescriptions).toBe(true)
    expect(checkbox(display, 'Names').checked).toBe(false)
    expect(checkbox(display, 'Descriptions').checked).toBe(true)
  })
})
