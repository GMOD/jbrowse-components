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
  menuItems: MenuItem[]
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
  menus.splice((position < 0 ? menus.length : 0) + position, 0, {
    label: menuName,
    menuItems: [],
  })
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
  return menu.menuItems.push(menuItem)
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
 * the second-to-last one.
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
  const insertPosition =
    position < 0 ? menu.menuItems.length + position : position
  menu.menuItems.splice(insertPosition, 0, menuItem)
  return menu.menuItems.length
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
  let topMenu = menus.find(m => m.label === menuPath[0])
  if (!topMenu) {
    const idx = appendMenu({ menus, menuName: menuPath[0]! })
    topMenu = menus[idx - 1]!
  }
  let { menuItems: subMenu } = topMenu
  const pathSoFar = [menuPath[0]]
  for (const menuName of menuPath.slice(1)) {
    pathSoFar.push(menuName)
    let sm = subMenu.find(mi => 'label' in mi && mi.label === menuName)
    if (!sm) {
      const idx = subMenu.push({ label: menuName, subMenu: [] })
      sm = subMenu[idx - 1]!
    }
    if (!('subMenu' in sm)) {
      throw new Error(`"${menuName}" in path "${pathSoFar}" is not a subMenu`)
    }
    subMenu = sm.subMenu
  }
  return subMenu.push(menuItem)
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
  let topMenu = menus.find(m => m.label === menuPath[0])
  if (!topMenu) {
    const idx = appendMenu({ menus, menuName: menuPath[0]! })
    topMenu = menus[idx - 1]!
  }
  let { menuItems: subMenu } = topMenu
  const pathSoFar = [menuPath[0]]
  for (const menuName of menuPath.slice(1)) {
    pathSoFar.push(menuName)
    let sm = subMenu.find(mi => 'label' in mi && mi.label === menuName)
    if (!sm) {
      const idx = subMenu.push({ label: menuName, subMenu: [] })
      sm = subMenu[idx - 1]!
    }
    if (!('subMenu' in sm)) {
      throw new Error(`"${menuName}" in path "${pathSoFar}" is not a subMenu`)
    }
    subMenu = sm.subMenu
  }
  subMenu.splice(position, 0, menuItem)
  return subMenu.length
}

export function processMutableMenuActions(ret: Menu[], actions: MenuAction[]) {
  for (const action of actions) {
    if (action.type === 'setMenus') {
      ret = action.newMenus
    } else if (action.type === 'appendMenu') {
      appendMenu({ menus: ret, ...action })
    } else if (action.type === 'insertMenu') {
      insertMenu({ menus: ret, ...action })
    } else if (action.type === 'insertInSubMenu') {
      insertInSubMenu({ menus: ret, ...action })
    } else if (action.type === 'appendToSubMenu') {
      appendToSubMenu({ menus: ret, ...action })
    } else if (action.type === 'appendToMenu') {
      appendToMenu({ menus: ret, ...action })
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    } else if (action.type === 'insertInMenu') {
      insertInMenu({ menus: ret, ...action })
    }
  }
  return ret
}
