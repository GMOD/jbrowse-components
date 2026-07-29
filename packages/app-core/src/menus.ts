import type { MenuItem } from '@jbrowse/core/ui'

interface InsertInSubMenuAction {
  type: 'insertInSubMenu'
  menuPath: string[]
  menuItem: MenuItem
  position: number
}
interface InsertInMenuAction {
  type: 'insertInMenu'
  menuName: string
  menuItem: MenuItem
  position: number
}
interface AppendToMenuAction {
  type: 'appendToMenu'
  menuName: string
  menuItem: MenuItem
}
interface AppendToSubMenuAction {
  type: 'appendToSubMenu'
  menuPath: string[]
  menuItem: MenuItem
}
interface AppendMenuAction {
  type: 'appendMenu'
  menuName: string
}
interface InsertMenuAction {
  type: 'insertMenu'
  menuName: string
  position: number
}
interface SetMenusAction {
  type: 'setMenus'
  newMenus: Menu[]
}

export type MenuAction =
  | InsertMenuAction
  | AppendMenuAction
  | AppendToSubMenuAction
  | AppendToMenuAction
  | InsertInMenuAction
  | InsertInSubMenuAction
  | SetMenusAction

export interface Menu {
  label: string
  // array form, or a thunk for menus whose items are computed fresh each time
  // they open (e.g. a "recent sessions" list)
  menuItems: MenuItem[] | (() => MenuItem[])
}

// recursively copy the array spine so later splice/push helpers never mutate
// the caller's array; leaf items (with their onClick/icon) are shared by ref
function cloneMenuItems(items: MenuItem[]): MenuItem[] {
  return items.map(item =>
    'subMenu' in item
      ? { ...item, subMenu: cloneMenuItems(item.subMenu) }
      : item,
  )
}

// An array-form menu is mutated in place. A thunk-form menu recomputes its
// items every time it opens, so there is nothing to splice into now: compose
// the mutation into a new thunk that applies it to each fresh result.
function mutateMenuItems(menu: Menu, mutate: (items: MenuItem[]) => void) {
  const { menuItems } = menu
  if (typeof menuItems === 'function') {
    menu.menuItems = () => {
      const items = cloneMenuItems(menuItems())
      mutate(items)
      return items
    }
  } else {
    mutate(menuItems)
  }
}

/**
 * #action
 * Add a top-level menu
 *
 * @param menuName - Name of the menu to insert.
 *
 * @returns The new length of the top-level menus array
 */
export function appendMenu({
  menus,
  menuName,
}: {
  menus: Menu[]
  menuName: string
}) {
  return menus.push({ label: menuName, menuItems: [] })
}
/**
 * #action
 * Insert a top-level menu
 *
 * @param menuName - Name of the menu to insert.
 *
 * @param position - Position to insert menu. If negative, counts from th
 * end, e.g. `insertMenu('My Menu', -1)` will insert the menu as the
 * second-to-last one.
 *
 * @returns The new length of the top-level menus array
 */
export function insertMenu({
  menus,
  menuName,
  position,
}: {
  menus: Menu[]
  menuName: string
  position: number
}) {
  const insertPosition = position < 0 ? menus.length + position : position
  menus.splice(insertPosition, 0, { label: menuName, menuItems: [] })
  return menus.length
}
/**
 * #action
 * Add a menu item to a top-level menu
 *
 * @param menuName - Name of the top-level menu to append to.
 *
 * @param menuItem - Menu item to append.
 */
export function appendToMenu({
  menus,
  menuName,
  menuItem,
}: {
  menus: Menu[]
  menuName: string
  menuItem: MenuItem
}) {
  const menu = menus.find(m => m.label === menuName)
  if (menu) {
    mutateMenuItems(menu, items => {
      items.push(menuItem)
    })
  } else {
    menus.push({ label: menuName, menuItems: [menuItem] })
  }
}
/**
 * #action
 * Insert a menu item into a top-level menu
 *
 * @param menuName - Name of the top-level menu to insert into
 *
 * @param menuItem - Menu item to insert
 *
 * @param position - Position to insert menu item. If negative, counts
 * from the end, e.g. `insertMenu('My Menu', -1)` will insert the menu as
 * the second-to-last one. Note: a menu item with a `priority` set is
 * re-sorted at render time, which overrides this position.
 */
export function insertInMenu({
  menus,
  menuName,
  menuItem,
  position,
}: {
  menus: Menu[]
  menuName: string
  menuItem: MenuItem
  position: number
}) {
  const menu = menus.find(m => m.label === menuName)
  if (menu) {
    mutateMenuItems(menu, items => {
      items.splice(
        position < 0 ? items.length + position : position,
        0,
        menuItem,
      )
    })
  } else {
    menus.push({ label: menuName, menuItems: [menuItem] })
  }
}
/**
 * Find-or-create the top-level menu named by `menuPath[0]`, then walk the
 * remaining path segments (creating empty sub-menus as needed) and apply
 * `mutate` to the deepest sub-menu's item array. Throws if a path segment
 * exists but is not a sub-menu.
 */
function mutateSubMenuItems(
  menus: Menu[],
  menuPath: string[],
  mutate: (items: MenuItem[]) => void,
) {
  let topMenu = menus.find(m => m.label === menuPath[0])
  if (!topMenu) {
    const idx = appendMenu({ menus, menuName: menuPath[0]! })
    topMenu = menus[idx - 1]!
  }
  mutateMenuItems(topMenu, items => {
    let subMenu = items
    const pathSoFar = [menuPath[0]]
    for (const menuName of menuPath.slice(1)) {
      pathSoFar.push(menuName)
      let sm = subMenu.find(mi => 'label' in mi && mi.label === menuName)
      if (!sm) {
        const idx = subMenu.push({ label: menuName, subMenu: [] })
        sm = subMenu[idx - 1]!
      }
      if (!('subMenu' in sm)) {
        throw new Error(
          `"${menuName}" in path "${pathSoFar.join(' > ')}" is not a subMenu`,
        )
      }
      subMenu = sm.subMenu
    }
    mutate(subMenu)
  })
}
/**
 * #action
 * Add a menu item to a sub-menu
 *
 * @param menuPath - Path to the sub-menu to add to, starting with the
 * top-level menu (e.g. `['File', 'Insert']`).
 *
 * @param menuItem - Menu item to append.
 */
export function appendToSubMenu({
  menus,
  menuPath,
  menuItem,
}: {
  menus: Menu[]
  menuPath: string[]
  menuItem: MenuItem
}) {
  mutateSubMenuItems(menus, menuPath, items => {
    items.push(menuItem)
  })
}
/**
 * #action
 * Insert a menu item into a sub-menu
 *
 * @param menuPath - Path to the sub-menu to add to, starting with the
 * top-level menu (e.g. `['File', 'Insert']`).
 *
 * @param menuItem - Menu item to insert.
 *
 * @param position - Position to insert menu item. If negative, counts
 * from the end, e.g. `insertMenu('My Menu', -1)` will insert the menu as
 * the second-to-last one.
 */
export function insertInSubMenu({
  menus,
  menuPath,
  menuItem,
  position,
}: {
  menus: Menu[]
  menuPath: string[]
  menuItem: MenuItem
  position: number
}) {
  mutateSubMenuItems(menus, menuPath, items => {
    items.splice(position < 0 ? items.length + position : position, 0, menuItem)
  })
}

export function processMutableMenuActions(ret: Menu[], actions: MenuAction[]) {
  for (const action of actions) {
    switch (action.type) {
      case 'setMenus': {
        // clone, otherwise subsequent mutating actions splice into the stored
        // action's array and accumulate across every menus() re-render
        ret = action.newMenus.map(m => ({
          ...m,
          menuItems:
            typeof m.menuItems === 'function'
              ? m.menuItems
              : cloneMenuItems(m.menuItems),
        }))
        break
      }
      case 'appendMenu': {
        appendMenu({ menus: ret, ...action })
        break
      }
      case 'insertMenu': {
        insertMenu({ menus: ret, ...action })
        break
      }
      case 'insertInSubMenu': {
        insertInSubMenu({ menus: ret, ...action })
        break
      }
      case 'appendToSubMenu': {
        appendToSubMenu({ menus: ret, ...action })
        break
      }
      case 'appendToMenu': {
        appendToMenu({ menus: ret, ...action })
        break
      }
      case 'insertInMenu': {
        insertInMenu({ menus: ret, ...action })
        break
      }
      default: {
        return action satisfies never
      }
    }
  }
  return ret
}
