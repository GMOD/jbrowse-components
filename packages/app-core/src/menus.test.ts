import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import { processMutableMenuActions, resolveMenus } from './menus.ts'

import type { Menu, MenuAction } from './menus.ts'
import type { MenuItem, SubMenuItem } from '@jbrowse/core/ui/menuItems'

function item(label: string) {
  return { label } as unknown as MenuItem
}

function subMenu(label: string, items: MenuItem[] | (() => MenuItem[])) {
  return { label, subMenu: items } as SubMenuItem
}

// open a resolved menu the way the app bar does
function labelsOf(menu: Menu) {
  return menu.menuItems().map(i => ('label' in i ? i.label : ''))
}

function findSubMenu(items: MenuItem[], label: string) {
  const found = items.find(i => 'subMenu' in i && i.label === label)
  if (!found || !('subMenu' in found)) {
    throw new Error(`no sub-menu ${label}`)
  }
  return found
}

function run(base: Menu[], actions: MenuAction[]) {
  return processMutableMenuActions(base, actions)
}

describe('menu structure', () => {
  it('appends a top-level menu', () => {
    const menus = run([], [{ type: 'addMenu', menuName: 'File' }])
    expect(menus.map(m => m.label)).toEqual(['File'])
    expect(menus[0]!.menuItems()).toEqual([])
  })

  it('inserts a top-level menu at a position', () => {
    const menus = run(
      [
        { label: 'File', menuItems: () => [] },
        { label: 'Help', menuItems: () => [] },
      ],
      [{ type: 'addMenu', menuName: 'Edit', position: 1 }],
    )
    expect(menus.map(m => m.label)).toEqual(['File', 'Edit', 'Help'])
  })

  it('inserts a top-level menu at a negative position', () => {
    const menus = run(
      [
        { label: 'File', menuItems: () => [] },
        { label: 'Help', menuItems: () => [] },
      ],
      [{ type: 'addMenu', menuName: 'Edit', position: -1 }],
    )
    expect(menus.map(m => m.label)).toEqual(['File', 'Edit', 'Help'])
  })

  // the app bar renders a button per menu before anything opens, so a plugin
  // populating a menu it never declared still has to get one
  it('creates a menu named by an item contribution alone', () => {
    const menus = run(
      [],
      [{ type: 'addItem', menuPath: ['MyPlugin'], menuItem: item('Go') }],
    )
    expect(menus.map(m => m.label)).toEqual(['MyPlugin'])
    expect(labelsOf(menus[0]!)).toEqual(['Go'])
  })

  // labels key the React elements and name an item contribution's target, so
  // two menus with one label is never what a caller wanted
  it('does not duplicate a menu that already exists', () => {
    const menus = run(
      [{ label: 'File', menuItems: () => [item('Open')] }],
      [
        { type: 'addMenu', menuName: 'File' },
        { type: 'addMenu', menuName: 'Help', position: 0 },
        { type: 'addMenu', menuName: 'Help' },
        { type: 'addItem', menuPath: ['File'], menuItem: item('added') },
      ],
    )
    expect(menus.map(m => m.label)).toEqual(['Help', 'File'])
    expect(labelsOf(menus[1]!)).toEqual(['Open', 'added'])
  })
})

describe('item contributions', () => {
  const base: Menu[] = [
    { label: 'File', menuItems: () => [item('Open'), item('Close')] },
  ]

  it('appends in order', () => {
    const menus = run(base, [
      { type: 'addItem', menuPath: ['File'], menuItem: item('a') },
      { type: 'addItem', menuPath: ['File'], menuItem: item('b') },
    ])
    expect(labelsOf(menus[0]!)).toEqual(['Open', 'Close', 'a', 'b'])
  })

  it('inserts at a position', () => {
    const menus = run(base, [
      {
        type: 'addItem',
        menuPath: ['File'],
        menuItem: item('Save'),
        position: 1,
      },
    ])
    expect(labelsOf(menus[0]!)).toEqual(['Open', 'Save', 'Close'])
  })

  it('inserts at a negative position', () => {
    const menus = run(base, [
      {
        type: 'addItem',
        menuPath: ['File'],
        menuItem: item('Save'),
        position: -1,
      },
    ])
    expect(labelsOf(menus[0]!)).toEqual(['Open', 'Save', 'Close'])
  })

  it('creates and fills a sub-menu along a path', () => {
    const menus = run(base, [
      {
        type: 'addItem',
        menuPath: ['File', 'Import'],
        menuItem: item('From File'),
      },
      {
        type: 'addItem',
        menuPath: ['File', 'Import'],
        menuItem: item('From HTTPS'),
      },
      {
        type: 'addItem',
        menuPath: ['File', 'Import'],
        menuItem: item('From URL'),
        position: 1,
      },
    ])
    expect(findSubMenu(menus[0]!.menuItems(), 'Import')).toMatchObject({
      subMenu: [
        { label: 'From File' },
        { label: 'From URL' },
        { label: 'From HTTPS' },
      ],
    })
  })

  it('nests sub-menus arbitrarily deep', () => {
    const menus = run(base, [
      {
        type: 'addItem',
        menuPath: ['File', 'Import', 'Remote'],
        menuItem: item('From URL'),
      },
    ])
    expect(menus[0]!.menuItems()).toContainEqual({
      label: 'Import',
      subMenu: [{ label: 'Remote', subMenu: [{ label: 'From URL' }] }],
    })
  })

  // a created sub-menu lands where the contribution that first named it would
  // have, so a later append still goes after it
  it('creates a sub-menu at the point of its first contribution', () => {
    const menus = run(base, [
      {
        type: 'addItem',
        menuPath: ['File', 'Import'],
        menuItem: item('From URL'),
      },
      { type: 'addItem', menuPath: ['File'], menuItem: item('added') },
    ])
    expect(labelsOf(menus[0]!)).toEqual(['Open', 'Close', 'Import', 'added'])
  })

  // a single-segment path names the top-level menu itself, which is what
  // appendToMenu records
  it('treats a one-segment path as the top-level menu', () => {
    const menus = run(base, [
      { type: 'addItem', menuPath: ['File'], menuItem: item('added') },
    ])
    expect(labelsOf(menus[0]!)).toEqual(['Open', 'Close', 'added'])
  })

  // a plugin naming a path that isn't a sub-menu is a plugin bug, and it must
  // cost that plugin its menu item rather than cost the user their session
  it('drops only the contributions under a path that is not a sub-menu', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const menus = run(base, [
      { type: 'addItem', menuPath: ['File'], menuItem: item('added') },
      {
        type: 'addItem',
        menuPath: ['File', 'Open', 'Nested'],
        menuItem: item('x'),
      },
      { type: 'addItem', menuPath: ['File'], menuItem: item('also added') },
    ])
    // resolution is deferred to open, so the bar itself still renders
    expect(menus.map(m => m.label)).toEqual(['File'])
    expect(labelsOf(menus[0]!)).toEqual([
      'Open',
      'Close',
      'added',
      'also added',
    ])
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '"Open" in path "File > Open" is not a subMenu',
      }),
    )
    spy.mockRestore()
  })

  // the menu re-resolves on every open, on every observer re-render while open,
  // and from scratch on every menus() evaluation; a broken contribution must
  // not spam the console from any of them
  it('reports a broken contribution once', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const actions: MenuAction[] = [
      {
        type: 'addItem',
        menuPath: ['File', 'Close', 'Nested'],
        menuItem: item('x'),
      },
    ]
    const menus = run(base, actions)
    menus[0]!.menuItems()
    menus[0]!.menuItems()
    run(base, actions)[0]!.menuItems()
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  // the definition is reused across every menus() evaluation and every open, so
  // resolution must never write back into it
  it('does not mutate the definitions it resolves', () => {
    const fileItems = [item('Open')]
    const viewsItems = [item('LGV')]
    const addItems = [subMenu('Views', viewsItems)]
    const definitions: Menu[] = [
      { label: 'File', menuItems: () => fileItems },
      { label: 'Add', menuItems: () => addItems },
    ]
    const menus = run(definitions, [
      { type: 'addItem', menuPath: ['File'], menuItem: item('added') },
      {
        type: 'addItem',
        menuPath: ['Add', 'Views'],
        menuItem: item('Dotplot'),
      },
    ])
    expect(labelsOf(menus[0]!)).toEqual(['Open', 'added'])
    expect(findSubMenu(menus[1]!.menuItems(), 'Views')).toMatchObject({
      subMenu: [{ label: 'LGV' }, { label: 'Dotplot' }],
    })
    expect(fileItems).toEqual([{ label: 'Open' }])
    expect(viewsItems).toEqual([{ label: 'LGV' }])
    expect(addItems).toEqual([{ label: 'Views', subMenu: [{ label: 'LGV' }] }])
  })

  // a caller that edits what it got back must not be editing the root model's
  // own array, whether or not the menu had contributions
  it('hands out a fresh array even with no contributions', () => {
    const fileItems = [item('Open')]
    const menus = run([{ label: 'File', menuItems: () => fileItems }], [])
    expect(menus[0]!.menuItems()).not.toBe(fileItems)
  })

  // a contributed sub-menu is a path later contributions resolve into; the
  // action's own payload must come through every open unchanged
  it('does not accumulate in a sub-menu another contribution supplied', () => {
    const payload = subMenu('My plugin', [item('Its own view')])
    const actions: MenuAction[] = [
      { type: 'addItem', menuPath: ['Add'], menuItem: payload },
      {
        type: 'addItem',
        menuPath: ['Add', 'My plugin'],
        menuItem: item('A second view'),
      },
    ]
    const menus = run([{ label: 'Add', menuItems: () => [] }], actions)
    const opened = () => menus[0]!.menuItems()
    const expected = [
      {
        label: 'My plugin',
        subMenu: [{ label: 'Its own view' }, { label: 'A second view' }],
      },
    ]
    expect(opened()).toEqual(expected)
    expect(opened()).toEqual(expected)
    expect(
      run([{ label: 'Add', menuItems: () => [] }], actions)[0]!.menuItems(),
    ).toEqual(expected)
    expect(payload).toEqual({
      label: 'My plugin',
      subMenu: [{ label: 'Its own view' }],
    })
  })

  // menus() replays the whole action log on every re-render, and a menu can be
  // opened any number of times; neither may accumulate
  it('is stable across replays and repeated opens', () => {
    const actions: MenuAction[] = [
      { type: 'addItem', menuPath: ['File'], menuItem: item('added') },
      {
        type: 'addItem',
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

// jbrowse-web's File menu reads the session metadata its recent-sessions list
// needs, and the app bar must not track those reads. Plugins still append to
// it by name — jbrowse-plugin-hubs does exactly this
describe('lazy menus', () => {
  it('merges contributions into the menu', () => {
    const menus = run(
      [{ label: 'File', menuItems: () => [item('New session')] }],
      [
        {
          type: 'addItem',
          menuPath: ['File'],
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
      [{ type: 'addItem', menuPath: ['File'], menuItem: item('added') }],
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
      [{ type: 'addItem', menuPath: ['File'], menuItem: item('added') }],
    )
    expect(called).toBe(0)
    expect(menus.map(m => m.label)).toEqual(['File'])
    expect(called).toBe(0)
  })

  // a sub-menu whose rows are a thunk is resolved when its panel opens, not
  // when its parent does; a contribution into it must keep that
  it('keeps a thunk sub-menu lazy and merges into it when it opens', () => {
    let called = 0
    const menus = run(
      [
        {
          label: 'Add',
          menuItems: () => [
            subMenu('Views', () => {
              called += 1
              return [item('LGV')]
            }),
          ],
        },
      ],
      [{ type: 'addItem', menuPath: ['Add', 'Views'], menuItem: item('Dot') }],
    )
    const views = findSubMenu(menus[0]!.menuItems(), 'Views')
    expect(called).toBe(0)
    expect(typeof views.subMenu).toBe('function')
    expect(resolveSubMenu(views)).toMatchObject([
      { label: 'LGV' },
      { label: 'Dot' },
    ])
    expect(called).toBe(1)
    expect(resolveSubMenu(views)).toMatchObject([
      { label: 'LGV' },
      { label: 'Dot' },
    ])
    expect(called).toBe(2)
  })

  it('keeps a contributed thunk sub-menu lazy too', () => {
    let called = 0
    const menus = run(
      [{ label: 'Add', menuItems: () => [] }],
      [
        {
          type: 'addItem',
          menuPath: ['Add'],
          menuItem: subMenu('My plugin', () => {
            called += 1
            return [item('Its own view')]
          }),
        },
        {
          type: 'addItem',
          menuPath: ['Add', 'My plugin'],
          menuItem: item('A second view'),
        },
      ],
    )
    const mine = findSubMenu(menus[0]!.menuItems(), 'My plugin')
    expect(called).toBe(0)
    expect(resolveSubMenu(mine)).toMatchObject([
      { label: 'Its own view' },
      { label: 'A second view' },
    ])
    expect(called).toBe(1)
  })
})

describe('resolveMenus', () => {
  it('opens every menu and returns plain data', () => {
    const menus = run(
      [
        { label: 'File', menuItems: () => [item('New session')] },
        { label: 'Add', menuItems: () => [] },
      ],
      [
        {
          type: 'addItem',
          menuPath: ['Add'],
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
