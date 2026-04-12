import {
  appendMenu,
  appendToMenu,
  appendToSubMenu,
  insertInMenu,
  insertInSubMenu,
  insertMenu,
  processMutableMenuActions,
} from './menus.ts'

import type { Menu } from './menus.ts'

function makeMenus(): Menu[] {
  return []
}

describe('appendMenu', () => {
  it('adds a top-level menu', () => {
    const menus = makeMenus()
    appendMenu({ menus, menuName: 'File' })
    expect(menus).toHaveLength(1)
    expect(menus[0]!.label).toBe('File')
    expect(menus[0]!.menuItems).toEqual([])
  })

  it('can add multiple menus', () => {
    const menus = makeMenus()
    appendMenu({ menus, menuName: 'File' })
    appendMenu({ menus, menuName: 'Edit' })
    expect(menus.map(m => m.label)).toEqual(['File', 'Edit'])
  })
})

describe('insertMenu', () => {
  it('inserts at a given position', () => {
    const menus = makeMenus()
    appendMenu({ menus, menuName: 'File' })
    appendMenu({ menus, menuName: 'Help' })
    insertMenu({ menus, menuName: 'Edit', position: 1 })
    expect(menus.map(m => m.label)).toEqual(['File', 'Edit', 'Help'])
  })

  it('inserts at negative position (from end)', () => {
    const menus = makeMenus()
    appendMenu({ menus, menuName: 'File' })
    appendMenu({ menus, menuName: 'Help' })
    insertMenu({ menus, menuName: 'Edit', position: -1 })
    expect(menus.map(m => m.label)).toEqual(['File', 'Edit', 'Help'])
  })

  it('inserts at position 0', () => {
    const menus = makeMenus()
    appendMenu({ menus, menuName: 'Help' })
    insertMenu({ menus, menuName: 'File', position: 0 })
    expect(menus.map(m => m.label)).toEqual(['File', 'Help'])
  })
})

describe('appendToMenu', () => {
  it('appends a menu item to an existing menu', () => {
    const menus = makeMenus()
    appendMenu({ menus, menuName: 'File' })
    appendToMenu({ menus, menuName: 'File', menuItem: { label: 'Open' } })
    expect(menus[0]!.menuItems).toHaveLength(1)
    expect(menus[0]!.menuItems[0]).toMatchObject({ label: 'Open' })
  })

  it('creates the menu if it does not exist', () => {
    const menus = makeMenus()
    appendToMenu({ menus, menuName: 'File', menuItem: { label: 'Open' } })
    expect(menus).toHaveLength(1)
    expect(menus[0]!.label).toBe('File')
    expect(menus[0]!.menuItems[0]).toMatchObject({ label: 'Open' })
  })

  it('appends multiple items in order', () => {
    const menus = makeMenus()
    appendMenu({ menus, menuName: 'File' })
    appendToMenu({ menus, menuName: 'File', menuItem: { label: 'Open' } })
    appendToMenu({ menus, menuName: 'File', menuItem: { label: 'Save' } })
    const labels = menus[0]!.menuItems.map(i => ('label' in i ? i.label : ''))
    expect(labels).toEqual(['Open', 'Save'])
  })
})

describe('insertInMenu', () => {
  it('inserts a menu item at a specific position', () => {
    const menus = makeMenus()
    appendMenu({ menus, menuName: 'File' })
    appendToMenu({ menus, menuName: 'File', menuItem: { label: 'Open' } })
    appendToMenu({ menus, menuName: 'File', menuItem: { label: 'Close' } })
    insertInMenu({
      menus,
      menuName: 'File',
      menuItem: { label: 'Save' },
      position: 1,
    })
    const labels = menus[0]!.menuItems.map(i => ('label' in i ? i.label : ''))
    expect(labels).toEqual(['Open', 'Save', 'Close'])
  })

  it('inserts at negative position', () => {
    const menus = makeMenus()
    appendMenu({ menus, menuName: 'File' })
    appendToMenu({ menus, menuName: 'File', menuItem: { label: 'Open' } })
    appendToMenu({ menus, menuName: 'File', menuItem: { label: 'Close' } })
    insertInMenu({
      menus,
      menuName: 'File',
      menuItem: { label: 'Save' },
      position: -1,
    })
    const labels = menus[0]!.menuItems.map(i => ('label' in i ? i.label : ''))
    expect(labels).toEqual(['Open', 'Save', 'Close'])
  })
})

describe('appendToSubMenu', () => {
  it('appends to a nested sub-menu path', () => {
    const menus = makeMenus()
    appendMenu({ menus, menuName: 'File' })
    appendToSubMenu({
      menus,
      menuPath: ['File', 'Import'],
      menuItem: { label: 'From URL' },
    })
    const fileMenu = menus[0]!
    const importEntry = fileMenu.menuItems.find(
      i => 'label' in i && i.label === 'Import',
    )
    expect(importEntry).toBeDefined()
    expect('subMenu' in importEntry!).toBe(true)
  })

  it('creates missing top-level menu automatically', () => {
    const menus = makeMenus()
    appendToSubMenu({
      menus,
      menuPath: ['File', 'Import'],
      menuItem: { label: 'From URL' },
    })
    expect(menus[0]!.label).toBe('File')
  })

  it('throws when path segment is not a subMenu', () => {
    const menus = makeMenus()
    appendMenu({ menus, menuName: 'File' })
    appendToMenu({ menus, menuName: 'File', menuItem: { label: 'Open' } })
    expect(() => {
      appendToSubMenu({
        menus,
        menuPath: ['File', 'Open', 'Nested'],
        menuItem: { label: 'Item' },
      })
    }).toThrow()
  })
})

describe('insertInSubMenu', () => {
  it('inserts at a specific position in a sub-menu', () => {
    const menus = makeMenus()
    appendMenu({ menus, menuName: 'File' })
    appendToSubMenu({
      menus,
      menuPath: ['File', 'Import'],
      menuItem: { label: 'From File' },
    })
    appendToSubMenu({
      menus,
      menuPath: ['File', 'Import'],
      menuItem: { label: 'From HTTPS' },
    })
    insertInSubMenu({
      menus,
      menuPath: ['File', 'Import'],
      menuItem: { label: 'From URL' },
      position: 1,
    })
    const importEntry = menus[0]!.menuItems.find(
      i => 'label' in i && i.label === 'Import',
    )
    expect('subMenu' in importEntry!).toBe(true)
    const subLabels = (
      importEntry as { subMenu: { label: string }[] }
    ).subMenu.map(i => i.label)
    expect(subLabels).toEqual(['From File', 'From URL', 'From HTTPS'])
  })
})

describe('processMutableMenuActions', () => {
  it('processes setMenus action', () => {
    const initial: Menu[] = [{ label: 'Old', menuItems: [] }]
    const newMenus: Menu[] = [{ label: 'New', menuItems: [] }]
    const result = processMutableMenuActions(initial, [
      { type: 'setMenus', newMenus },
    ])
    expect(result.map(m => m.label)).toEqual(['New'])
  })

  it('processes appendMenu action', () => {
    const menus: Menu[] = []
    const result = processMutableMenuActions(menus, [
      { type: 'appendMenu', menuName: 'File' },
    ])
    expect(result.map(m => m.label)).toEqual(['File'])
  })

  it('processes insertMenu action', () => {
    const menus: Menu[] = [{ label: 'File', menuItems: [] }]
    const result = processMutableMenuActions(menus, [
      { type: 'insertMenu', menuName: 'Edit', position: 0 },
    ])
    expect(result.map(m => m.label)).toEqual(['Edit', 'File'])
  })

  it('processes appendToMenu action', () => {
    const menus: Menu[] = [{ label: 'File', menuItems: [] }]
    const result = processMutableMenuActions(menus, [
      { type: 'appendToMenu', menuName: 'File', menuItem: { label: 'Open' } },
    ])
    expect(result[0]!.menuItems[0]).toMatchObject({ label: 'Open' })
  })

  it('processes insertInMenu action', () => {
    const menus: Menu[] = [
      {
        label: 'File',
        menuItems: [{ label: 'Open' }, { label: 'Close' }],
      },
    ]
    const result = processMutableMenuActions(menus, [
      {
        type: 'insertInMenu',
        menuName: 'File',
        menuItem: { label: 'Save' },
        position: 1,
      },
    ])
    const labels = result[0]!.menuItems.map(i => ('label' in i ? i.label : ''))
    expect(labels).toEqual(['Open', 'Save', 'Close'])
  })

  it('processes multiple actions in sequence', () => {
    const menus: Menu[] = []
    const result = processMutableMenuActions(menus, [
      { type: 'appendMenu', menuName: 'File' },
      { type: 'appendMenu', menuName: 'Edit' },
      { type: 'appendToMenu', menuName: 'File', menuItem: { label: 'Open' } },
    ])
    expect(result.map(m => m.label)).toEqual(['File', 'Edit'])
    expect(result[0]!.menuItems[0]).toMatchObject({ label: 'Open' })
  })

  it('setMenus replaces previous state mid-sequence', () => {
    const menus: Menu[] = []
    const result = processMutableMenuActions(menus, [
      { type: 'appendMenu', menuName: 'File' },
      { type: 'setMenus', newMenus: [{ label: 'Help', menuItems: [] }] },
      { type: 'appendMenu', menuName: 'Edit' },
    ])
    expect(result.map(m => m.label)).toEqual(['Help', 'Edit'])
  })
})
