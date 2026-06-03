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

// the mutable menu helpers below can only operate on array-form menus; a
// thunk-form menu computes its items dynamically and has nothing to splice into
function staticItems(menu: Menu) {
  if (typeof menu.menuItems === 'function') {
    throw new Error(
      `cannot add items to the "${menu.label}" menu because its items are generated dynamically`,
    )
  }
  return menu.menuItems
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
 *
 * @returns The new length of the menu
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
  if (!menu) {
    menus.push({ label: menuName, menuItems: [menuItem] })
    return 1
  }
  return staticItems(menu).push(menuItem)
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
 *
 * @returns The new length of the menu
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
  if (!menu) {
    menus.push({ label: menuName, menuItems: [menuItem] })
    return 1
  }
  const items = staticItems(menu)
  const insertPosition = position < 0 ? items.length + position : position
  items.splice(insertPosition, 0, menuItem)
  return items.length
}
/**
 * Find-or-create the top-level menu named by `menuPath[0]`, then walk the
 * remaining path segments (creating empty sub-menus as needed) and return the
 * deepest sub-menu's item array. Throws if a path segment exists but is not a
 * sub-menu.
 */
function resolveSubMenuItems(menus: Menu[], menuPath: string[]) {
  let topMenu = menus.find(m => m.label === menuPath[0])
  if (!topMenu) {
    const idx = appendMenu({ menus, menuName: menuPath[0]! })
    topMenu = menus[idx - 1]!
  }
  let subMenu = staticItems(topMenu)
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
  return subMenu
}
/**
 * #action
 * Add a menu item to a sub-menu
 *
 * @param menuPath - Path to the sub-menu to add to, starting with the
 * top-level menu (e.g. `['File', 'Insert']`).
 *
 * @param menuItem - Menu item to append.
 *
 * @returns The new length of the sub-menu
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
  return resolveSubMenuItems(menus, menuPath).push(menuItem)
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
 *
 * @returns The new length of the sub-menu
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
  const subMenu = resolveSubMenuItems(menus, menuPath)
  const insertPosition = position < 0 ? subMenu.length + position : position
  subMenu.splice(insertPosition, 0, menuItem)
  return subMenu.length
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
