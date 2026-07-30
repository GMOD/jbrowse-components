import { processMutableMenuActions, resolveMenus } from './menus.ts'

import type { Menu, MenuAction, MenuDefinition } from './menus.ts'
import type { MenuItem } from '@jbrowse/core/ui'

function item(label: string) {
  return { label } as unknown as MenuItem
}

// open a resolved menu the way the app bar does
function labelsOf(menu: Menu) {
  return menu.menuItems().map(i => ('label' in i ? i.label : ''))
}

function run(base: MenuDefinition[], actions: MenuAction[]) {
  return processMutableMenuActions(base, actions)
}

describe('menu structure', () => {
  it('appends a top-level menu', () => {
    const menus = run([], [{ type: 'appendMenu', menuName: 'File' }])
    expect(menus.map(m => m.label)).toEqual(['File'])
    expect(menus[0]!.menuItems()).toEqual([])
  })

  it('inserts a top-level menu at a position', () => {
    const menus = run(
      [
        { label: 'File', menuItems: [] },
        { label: 'Help', menuItems: [] },
      ],
      [{ type: 'insertMenu', menuName: 'Edit', position: 1 }],
    )
    expect(menus.map(m => m.label)).toEqual(['File', 'Edit', 'Help'])
  })

  it('inserts a top-level menu at a negative position', () => {
    const menus = run(
      [
        { label: 'File', menuItems: [] },
        { label: 'Help', menuItems: [] },
      ],
      [{ type: 'insertMenu', menuName: 'Edit', position: -1 }],
    )
    expect(menus.map(m => m.label)).toEqual(['File', 'Edit', 'Help'])
  })

  // the app bar renders a button per menu before anything opens, so a plugin
  // populating a menu it never declared still has to get one
  it('creates a menu named by an item contribution alone', () => {
    const menus = run(
      [],
      [{ type: 'appendToMenu', menuName: 'MyPlugin', menuItem: item('Go') }],
    )
    expect(menus.map(m => m.label)).toEqual(['MyPlugin'])
    expect(labelsOf(menus[0]!)).toEqual(['Go'])
  })

  it('setMenus replaces the bar wholesale', () => {
    const menus = run(
      [{ label: 'File', menuItems: [] }],
      [
        { type: 'appendMenu', menuName: 'Tools' },
        { type: 'setMenus', newMenus: [{ label: 'Help', menuItems: [] }] },
        { type: 'appendMenu', menuName: 'Edit' },
      ],
    )
    expect(menus.map(m => m.label)).toEqual(['Help', 'Edit'])
  })

  // an item contribution is scoped to the menu bar it targeted; a later
  // setMenus discards that bar and the contributions aimed at it
  it('setMenus discards item contributions made before it', () => {
    const menus = run(
      [{ label: 'File', menuItems: [] }],
      [
        { type: 'appendToMenu', menuName: 'File', menuItem: item('early') },
        { type: 'setMenus', newMenus: [{ label: 'File', menuItems: [] }] },
        { type: 'appendToMenu', menuName: 'File', menuItem: item('late') },
      ],
    )
    expect(labelsOf(menus[0]!)).toEqual(['late'])
  })
})

describe('item contributions', () => {
  const base: MenuDefinition[] = [
    { label: 'File', menuItems: [item('Open'), item('Close')] },
  ]

  it('appends in order', () => {
    const menus = run(base, [
      { type: 'appendToMenu', menuName: 'File', menuItem: item('a') },
      { type: 'appendToMenu', menuName: 'File', menuItem: item('b') },
    ])
    expect(labelsOf(menus[0]!)).toEqual(['Open', 'Close', 'a', 'b'])
  })

  it('inserts at a position', () => {
    const menus = run(base, [
      {
        type: 'insertInMenu',
        menuName: 'File',
        menuItem: item('Save'),
        position: 1,
      },
    ])
    expect(labelsOf(menus[0]!)).toEqual(['Open', 'Save', 'Close'])
  })

  it('inserts at a negative position', () => {
    const menus = run(base, [
      {
        type: 'insertInMenu',
        menuName: 'File',
        menuItem: item('Save'),
        position: -1,
      },
    ])
    expect(labelsOf(menus[0]!)).toEqual(['Open', 'Save', 'Close'])
  })

  it('creates and fills a sub-menu along a path', () => {
    const menus = run(base, [
      {
        type: 'appendToSubMenu',
        menuPath: ['File', 'Import'],
        menuItem: item('From File'),
      },
      {
        type: 'appendToSubMenu',
        menuPath: ['File', 'Import'],
        menuItem: item('From HTTPS'),
      },
      {
        type: 'insertInSubMenu',
        menuPath: ['File', 'Import'],
        menuItem: item('From URL'),
        position: 1,
      },
    ])
    const importEntry = menus[0]!
      .menuItems()
      .find(i => 'label' in i && i.label === 'Import')
    expect(importEntry).toMatchObject({
      subMenu: [
        { label: 'From File' },
        { label: 'From URL' },
        { label: 'From HTTPS' },
      ],
    })
  })

  // a plugin naming a path that isn't a sub-menu is a plugin bug, and it must
  // cost that plugin its menu item rather than cost the user their session
  it('opens without the contributions when one of them throws', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const menus = run(base, [
      { type: 'appendToMenu', menuName: 'File', menuItem: item('added') },
      {
        type: 'appendToSubMenu',
        menuPath: ['File', 'Open', 'Nested'],
        menuItem: item('x'),
      },
    ])
    // resolution is deferred to open, so the bar itself still renders
    expect(menus.map(m => m.label)).toEqual(['File'])
    expect(labelsOf(menus[0]!)).toEqual(['Open', 'Close'])
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/is not a subMenu/),
      }),
    )
    spy.mockRestore()
  })

  // the definition is reused across every menus() evaluation and every open, so
  // resolution must never write back into it
  it('does not mutate the definitions it resolves', () => {
    const definitions: MenuDefinition[] = [
      { label: 'File', menuItems: [item('Open')] },
      { label: 'Add', menuItems: [{ label: 'Views', subMenu: [item('LGV')] }] },
    ]
    const menus = run(definitions, [
      { type: 'appendToMenu', menuName: 'File', menuItem: item('added') },
      {
        type: 'appendToSubMenu',
        menuPath: ['Add', 'Views'],
        menuItem: item('Dotplot'),
      },
    ])
    menus.map(m => m.menuItems())
    expect(definitions[0]!.menuItems).toEqual([{ label: 'Open' }])
    expect(definitions[1]!.menuItems).toEqual([
      { label: 'Views', subMenu: [{ label: 'LGV' }] },
    ])
  })

  // menus() replays the whole action log on every re-render, and a menu can be
  // opened any number of times; neither may accumulate
  it('is stable across replays and repeated opens', () => {
    const actions: MenuAction[] = [
      { type: 'appendToMenu', menuName: 'File', menuItem: item('added') },
      {
        type: 'appendToSubMenu',
        menuPath: ['File', 'Import'],
        menuItem: item('From URL'),
      },
    ]
    const first = run(base, actions)
    expect(labelsOf(first[0]!)).toEqual(['Open', 'Close', 'added', 'Import'])
    expect(labelsOf(first[0]!)).toEqual(['Open', 'Close', 'added', 'Import'])
    expect(labelsOf(run(base, actions)[0]!)).toEqual([
      'Open',
      'Close',
      'added',
      'Import',
    ])
  })
})

// jbrowse-web's File menu is a thunk so the app bar doesn't track the session
// metadata its recent-sessions list reads. Plugins still append to it by name —
// jbrowse-plugin-hubs does exactly this — which used to throw and take the app
// down with it.
describe('thunk-form definitions', () => {
  it('merges contributions into a thunk menu', () => {
    const menus = run(
      [{ label: 'File', menuItems: () => [item('New session')] }],
      [
        {
          type: 'appendToMenu',
          menuName: 'File',
          menuItem: item('Download desktop session'),
        },
      ],
    )
    expect(labelsOf(menus[0]!)).toEqual([
      'New session',
      'Download desktop session',
    ])
  })

  // the whole point of the thunk: its items are whatever the model says at open
  // time, with the contribution merged onto each fresh result exactly once
  it('re-runs the thunk on every open', () => {
    let opens = 0
    const menus = run(
      [
        {
          label: 'File',
          menuItems: () => {
            opens += 1
            return [item(`session ${opens}`)]
          },
        },
      ],
      [{ type: 'appendToMenu', menuName: 'File', menuItem: item('added') }],
    )
    expect(opens).toBe(0)
    expect(labelsOf(menus[0]!)).toEqual(['session 1', 'added'])
    expect(labelsOf(menus[0]!)).toEqual(['session 2', 'added'])
  })

  // resolving the bar must not open any menu — that is what would put the
  // thunk's reads back inside the app bar's tracking scope
  it('does not call a thunk while resolving the bar', () => {
    let called = 0
    const menus = run(
      [
        {
          label: 'File',
          menuItems: () => {
            called += 1
            return []
          },
        },
      ],
      [{ type: 'appendToMenu', menuName: 'File', menuItem: item('added') }],
    )
    expect(called).toBe(0)
    expect(menus.map(m => m.label)).toEqual(['File'])
    expect(called).toBe(0)
  })

  it('fills a sub-menu of a thunk menu', () => {
    const menus = run(
      [{ label: 'File', menuItems: () => [item('New session')] }],
      [
        {
          type: 'appendToSubMenu',
          menuPath: ['File', 'Import'],
          menuItem: item('From URL'),
        },
      ],
    )
    expect(menus[0]!.menuItems()).toContainEqual({
      label: 'Import',
      subMenu: [{ label: 'From URL' }],
    })
  })
})

describe('resolveMenus', () => {
  it('opens every menu and returns plain data', () => {
    const menus = run(
      [
        { label: 'File', menuItems: () => [item('New session')] },
        { label: 'Add', menuItems: [] },
      ],
      [
        {
          type: 'appendToMenu',
          menuName: 'Add',
          menuItem: item('Linear view'),
        },
      ],
    )
    expect(resolveMenus(menus)).toEqual([
      { label: 'File', menuItems: [{ label: 'New session' }] },
      { label: 'Add', menuItems: [{ label: 'Linear view' }] },
    ])
  })
})
