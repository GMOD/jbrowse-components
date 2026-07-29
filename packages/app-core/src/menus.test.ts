import {
  appendMenu,
  appendToMenu,
  appendToSubMenu,
  insertInMenu,
  insertInSubMenu,
  insertMenu,
  processMutableMenuActions,
} from './menus.ts'

import type { Menu, MenuAction } from './menus.ts'
import type { MenuItem } from '@jbrowse/core/ui'

function makeMenus(): Menu[] {
  return []
}

// resolve either menu form to the items a reader would see on open
function itemsOf(menu: Menu): MenuItem[] {
  return typeof menu.menuItems === 'function'
    ? menu.menuItems()
    : menu.menuItems
}

function labelsOf(menu: Menu) {
  return itemsOf(menu).map(i => ('label' in i ? i.label : ''))
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
    appendToMenu({
      menus,
      menuName: 'File',
      menuItem: { label: 'Open' } as unknown as MenuItem,
    })
    expect(menus[0]!.menuItems).toHaveLength(1)
    expect(itemsOf(menus[0]!)[0]).toMatchObject({ label: 'Open' })
  })

  it('creates the menu if it does not exist', () => {
    const menus = makeMenus()
    appendToMenu({
      menus,
      menuName: 'File',
      menuItem: { label: 'Open' } as unknown as MenuItem,
    })
    expect(menus).toHaveLength(1)
    expect(menus[0]!.label).toBe('File')
    expect(itemsOf(menus[0]!)[0]).toMatchObject({ label: 'Open' })
  })

  it('appends multiple items in order', () => {
    const menus = makeMenus()
    appendMenu({ menus, menuName: 'File' })
    appendToMenu({
      menus,
      menuName: 'File',
      menuItem: { label: 'Open' } as unknown as MenuItem,
    })
    appendToMenu({
      menus,
      menuName: 'File',
      menuItem: { label: 'Save' } as unknown as MenuItem,
    })
    const labels = itemsOf(menus[0]!).map(i => ('label' in i ? i.label : ''))
    expect(labels).toEqual(['Open', 'Save'])
  })
})

describe('insertInMenu', () => {
  it('inserts a menu item at a specific position', () => {
    const menus = makeMenus()
    appendMenu({ menus, menuName: 'File' })
    appendToMenu({
      menus,
      menuName: 'File',
      menuItem: { label: 'Open' } as unknown as MenuItem,
    })
    appendToMenu({
      menus,
      menuName: 'File',
      menuItem: { label: 'Close' } as unknown as MenuItem,
    })
    insertInMenu({
      menus,
      menuName: 'File',
      menuItem: { label: 'Save' } as unknown as MenuItem,
      position: 1,
    })
    const labels = itemsOf(menus[0]!).map(i => ('label' in i ? i.label : ''))
    expect(labels).toEqual(['Open', 'Save', 'Close'])
  })

  it('inserts at negative position', () => {
    const menus = makeMenus()
    appendMenu({ menus, menuName: 'File' })
    appendToMenu({
      menus,
      menuName: 'File',
      menuItem: { label: 'Open' } as unknown as MenuItem,
    })
    appendToMenu({
      menus,
      menuName: 'File',
      menuItem: { label: 'Close' } as unknown as MenuItem,
    })
    insertInMenu({
      menus,
      menuName: 'File',
      menuItem: { label: 'Save' } as unknown as MenuItem,
      position: -1,
    })
    const labels = itemsOf(menus[0]!).map(i => ('label' in i ? i.label : ''))
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
      menuItem: { label: 'From URL' } as unknown as MenuItem,
    })
    const fileMenu = menus[0]!
    const importEntry = itemsOf(fileMenu).find(
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
      menuItem: { label: 'From URL' } as unknown as MenuItem,
    })
    expect(menus[0]!.label).toBe('File')
  })

  it('throws when path segment is not a subMenu', () => {
    const menus = makeMenus()
    appendMenu({ menus, menuName: 'File' })
    appendToMenu({
      menus,
      menuName: 'File',
      menuItem: { label: 'Open' } as unknown as MenuItem,
    })
    expect(() => {
      appendToSubMenu({
        menus,
        menuPath: ['File', 'Open', 'Nested'],
        menuItem: { label: 'Item' } as unknown as MenuItem,
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
      menuItem: { label: 'From File' } as unknown as MenuItem,
    })
    appendToSubMenu({
      menus,
      menuPath: ['File', 'Import'],
      menuItem: { label: 'From HTTPS' } as unknown as MenuItem,
    })
    insertInSubMenu({
      menus,
      menuPath: ['File', 'Import'],
      menuItem: { label: 'From URL' } as unknown as MenuItem,
      position: 1,
    })
    const importEntry = itemsOf(menus[0]!).find(
      i => 'label' in i && i.label === 'Import',
    )
    expect('subMenu' in importEntry!).toBe(true)
    const subLabels = (
      importEntry as { subMenu: { label: string }[] }
    ).subMenu.map(i => i.label)
    expect(subLabels).toEqual(['From File', 'From URL', 'From HTTPS'])
  })
})

// jbrowse-web's File menu is a thunk (its recent-sessions list is recomputed on
// open), and plugins append to it by name — jbrowse-plugin-hubs does exactly
// this. The mutation has to compose into the thunk rather than reject it.
describe('thunk-form menus', () => {
  function makeThunkMenus(): Menu[] {
    return [
      {
        label: 'File',
        menuItems: () =>
          [
            { label: 'New session' },
            { label: 'Open' },
          ] as unknown as MenuItem[],
      },
    ]
  }

  it('appends to a thunk menu', () => {
    const menus = makeThunkMenus()
    appendToMenu({
      menus,
      menuName: 'File',
      menuItem: { label: 'Open track hub' } as unknown as MenuItem,
    })
    expect(labelsOf(menus[0]!)).toEqual([
      'New session',
      'Open',
      'Open track hub',
    ])
  })

  it('inserts into a thunk menu at a position', () => {
    const menus = makeThunkMenus()
    insertInMenu({
      menus,
      menuName: 'File',
      menuItem: { label: 'Save' } as unknown as MenuItem,
      position: 1,
    })
    expect(labelsOf(menus[0]!)).toEqual(['New session', 'Save', 'Open'])
  })

  it('appends to a sub-menu of a thunk menu', () => {
    const menus = makeThunkMenus()
    appendToSubMenu({
      menus,
      menuPath: ['File', 'Import'],
      menuItem: { label: 'From URL' } as unknown as MenuItem,
    })
    const importEntry = itemsOf(menus[0]!).find(
      i => 'label' in i && i.label === 'Import',
    )
    expect(importEntry).toMatchObject({
      label: 'Import',
      subMenu: [{ label: 'From URL' }],
    })
  })

  // the thunk's freshly-computed items are what a re-open must show, with the
  // appended item still there and appended only once
  it('re-runs the underlying thunk on every open', () => {
    let opens = 0
    const menus: Menu[] = [
      {
        label: 'File',
        menuItems: () => {
          opens += 1
          return [{ label: `open ${opens}` }] as unknown as MenuItem[]
        },
      },
    ]
    appendToMenu({
      menus,
      menuName: 'File',
      menuItem: { label: 'Open track hub' } as unknown as MenuItem,
    })
    expect(labelsOf(menus[0]!)).toEqual(['open 1', 'Open track hub'])
    expect(labelsOf(menus[0]!)).toEqual(['open 2', 'Open track hub'])
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
      {
        type: 'appendToMenu',
        menuName: 'File',
        menuItem: { label: 'Open' } as unknown as MenuItem,
      },
    ])
    expect(itemsOf(result[0]!)[0]).toMatchObject({ label: 'Open' })
  })

  it('processes insertInMenu action', () => {
    const menus: Menu[] = [
      {
        label: 'File',
        menuItems: [
          { label: 'Open' },
          { label: 'Close' },
        ] as unknown as MenuItem[],
      },
    ]
    const result = processMutableMenuActions(menus, [
      {
        type: 'insertInMenu',
        menuName: 'File',
        menuItem: { label: 'Save' } as unknown as MenuItem,
        position: 1,
      },
    ])
    const labels = itemsOf(result[0]!).map(i => ('label' in i ? i.label : ''))
    expect(labels).toEqual(['Open', 'Save', 'Close'])
  })

  it('processes multiple actions in sequence', () => {
    const menus: Menu[] = []
    const result = processMutableMenuActions(menus, [
      { type: 'appendMenu', menuName: 'File' },
      { type: 'appendMenu', menuName: 'Edit' },
      {
        type: 'appendToMenu',
        menuName: 'File',
        menuItem: { label: 'Open' } as unknown as MenuItem,
      },
    ])
    expect(result.map(m => m.label)).toEqual(['File', 'Edit'])
    expect(itemsOf(result[0]!)[0]).toMatchObject({ label: 'Open' })
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

  // menus() replays the same stored action list on every re-render, so the
  // processor must not mutate the arrays carried by setMenus actions
  it('is idempotent across replays when setMenus precedes a mutation', () => {
    const actions: MenuAction[] = [
      { type: 'setMenus', newMenus: [{ label: 'Help', menuItems: [] }] },
      {
        type: 'appendToMenu',
        menuName: 'Help',
        menuItem: { label: 'About' } as unknown as MenuItem,
      },
    ]
    const first = processMutableMenuActions([], actions)
    const second = processMutableMenuActions([], actions)
    expect(labelsOf(first[0]!)).toEqual(['About'])
    expect(labelsOf(second[0]!)).toEqual(['About'])
  })

  // same replay hazard as above, but the base menu is a thunk: wrapping must
  // not accumulate across the menus() re-renders that replay the action list
  it('is idempotent across replays into a thunk menu', () => {
    const actions: MenuAction[] = [
      {
        type: 'appendToMenu',
        menuName: 'File',
        menuItem: { label: 'Open track hub' } as unknown as MenuItem,
      },
    ]
    const base = (): Menu[] => [
      {
        label: 'File',
        menuItems: () => [{ label: 'New session' }] as unknown as MenuItem[],
      },
    ]
    expect(labelsOf(processMutableMenuActions(base(), actions)[0]!)).toEqual([
      'New session',
      'Open track hub',
    ])
    expect(labelsOf(processMutableMenuActions(base(), actions)[0]!)).toEqual([
      'New session',
      'Open track hub',
    ])
  })
})
