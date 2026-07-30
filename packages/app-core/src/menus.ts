import type { MenuItem, MenuItemsGetter } from '@jbrowse/core/ui'

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
  newMenus: MenuDefinition[]
}

// contributions that change which menus exist, so they have to resolve eagerly
// — the app bar renders one button per menu before anything is opened
type StructureAction = AppendMenuAction | InsertMenuAction | SetMenusAction

// contributions that only change a menu's contents, so they resolve when that
// menu opens, against whatever its items are at that moment
type ItemAction =
  | AppendToMenuAction
  | AppendToSubMenuAction
  | InsertInMenuAction
  | InsertInSubMenuAction

export type MenuAction = StructureAction | ItemAction

/**
 * A menu as a root model authors it. Items may be a plain array, or a thunk for
 * a menu whose contents depend on state that would otherwise be read — and so
 * tracked — every time the app bar renders.
 */
export interface MenuDefinition {
  label: string
  menuItems: MenuItemsGetter
}

/**
 * A menu as the app bar consumes it. Always a thunk: a menu's items are
 * produced when it opens and never before, so no consumer has to care which
 * form the root model authored, and a plugin's contributions are merged in at
 * that point rather than spliced into the definition.
 */
export interface Menu {
  label: string
  menuItems: () => MenuItem[]
}

// a menu whose contributions have been collected but not yet applied
interface PendingMenu {
  label: string
  base: MenuItemsGetter
  itemActions: ItemAction[]
}

// recursively copy the array spine so the item helpers never mutate a root
// model's own literal or a thunk's internals; leaf items (with their
// onClick/icon) are shared by ref
function cloneMenuItems(items: MenuItem[]): MenuItem[] {
  return items.map(item =>
    'subMenu' in item
      ? { ...item, subMenu: cloneMenuItems(item.subMenu) }
      : item,
  )
}

function materialize(menuItems: MenuItemsGetter) {
  return typeof menuItems === 'function' ? menuItems() : menuItems
}

function insertAt(items: MenuItem[], menuItem: MenuItem, position: number) {
  items.splice(position < 0 ? items.length + position : position, 0, menuItem)
}

/**
 * Walk `menuPath` past its first segment (the top-level menu, already
 * resolved), creating empty sub-menus as needed, and return the deepest
 * sub-menu's item array. Throws if a path segment exists but is not a sub-menu.
 */
function resolveSubMenu(items: MenuItem[], menuPath: string[]) {
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
  return subMenu
}

function applyItemActions(items: MenuItem[], actions: ItemAction[]) {
  for (const action of actions) {
    switch (action.type) {
      case 'appendToMenu': {
        items.push(action.menuItem)
        break
      }
      case 'insertInMenu': {
        insertAt(items, action.menuItem, action.position)
        break
      }
      case 'appendToSubMenu': {
        resolveSubMenu(items, action.menuPath).push(action.menuItem)
        break
      }
      case 'insertInSubMenu': {
        insertAt(
          resolveSubMenu(items, action.menuPath),
          action.menuItem,
          action.position,
        )
        break
      }
      default: {
        action satisfies never
      }
    }
  }
  return items
}

// first menu with this label, or a new empty one — an item action naming a menu
// that doesn't exist creates it, so a plugin can populate its own menu without
// declaring it first
function findOrCreateMenu(pending: PendingMenu[], label: string) {
  const found = pending.find(m => m.label === label)
  if (found) {
    return found
  }
  const menu: PendingMenu = { label, base: [], itemActions: [] }
  pending.push(menu)
  return menu
}

function toMenu({ label, base, itemActions }: PendingMenu): Menu {
  return {
    label,
    menuItems: itemActions.length
      ? () => {
          const items = materialize(base)
          // this runs from the app bar's click handler, so a contribution that
          // throws — a menuPath naming something that isn't a sub-menu, say —
          // would otherwise take the whole session down. A plugin's menu item
          // is cosmetic; drop the contributions and open the menu without them
          try {
            return applyItemActions(cloneMenuItems(items), itemActions)
          } catch (error) {
            console.error(error)
            return items
          }
        }
      : () => materialize(base),
  }
}

/**
 * Resolve a root model's menu definitions against the contributions plugins
 * have pushed (via `RootAppMenuMixin`). Structural contributions apply now;
 * item contributions are recorded against their target menu and applied when
 * that menu opens, so a menu that computes its items lazily stays lazy and
 * nothing is ever spliced into a definition.
 *
 * Runs on every `menus()` evaluation, so it must not mutate `base` or anything
 * an action carries.
 */
export function processMutableMenuActions(
  base: MenuDefinition[],
  actions: MenuAction[],
): Menu[] {
  const toPending = (m: MenuDefinition): PendingMenu => ({
    label: m.label,
    base: m.menuItems,
    itemActions: [],
  })
  let pending = base.map(toPending)
  for (const action of actions) {
    switch (action.type) {
      case 'setMenus': {
        // replaces the menu bar wholesale, so item contributions made before it
        // are dropped along with the menus they targeted
        pending = action.newMenus.map(toPending)
        break
      }
      case 'appendMenu': {
        pending.push({ label: action.menuName, base: [], itemActions: [] })
        break
      }
      case 'insertMenu': {
        const { position } = action
        pending.splice(position < 0 ? pending.length + position : position, 0, {
          label: action.menuName,
          base: [],
          itemActions: [],
        })
        break
      }
      case 'appendToMenu':
      case 'insertInMenu': {
        findOrCreateMenu(pending, action.menuName).itemActions.push(action)
        break
      }
      case 'appendToSubMenu':
      case 'insertInSubMenu': {
        findOrCreateMenu(pending, action.menuPath[0]!).itemActions.push(action)
        break
      }
      default: {
        action satisfies never
      }
    }
  }
  return pending.map(m => toMenu(m))
}

/**
 * Flatten resolved menus to plain data by opening every one of them. For tests
 * and other callers that want to assert on menu contents rather than render
 * them.
 */
export function resolveMenus(menus: Menu[]) {
  return menus.map(m => ({ label: m.label, menuItems: m.menuItems() }))
}
