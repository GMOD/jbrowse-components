import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'

import type { MenuItem, MenuItemsGetter, SubMenuItem } from '@jbrowse/core/ui'

/**
 * Ensure a top-level menu exists. `position` appends when omitted and counts
 * from the end when negative. A menu whose label is already on the bar is left
 * where it is — labels are the bar's identity (they key the React elements and
 * they are how an item contribution names its target), so two of them is never
 * what a caller wanted.
 */
interface AddMenuAction {
  type: 'addMenu'
  menuName: string
  position?: number
}

/**
 * Add one item at `menuPath` — the top-level menu, then any sub-menus, which
 * are created as needed. `position` appends when omitted and counts from the
 * end when negative.
 */
interface AddItemAction {
  type: 'addItem'
  menuPath: string[]
  menuItem: MenuItem
  position?: number
}

interface SetMenusAction {
  type: 'setMenus'
  newMenus: MenuDefinition[]
}

/**
 * `addMenu`/`setMenus` change which menus exist, so they resolve eagerly — the
 * app bar renders one button per menu before anything is opened. `addItem` only
 * changes a menu's contents, so it resolves when that menu opens, against
 * whatever its items are at that moment.
 */
export type MenuAction = AddMenuAction | AddItemAction | SetMenusAction

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
 * A menu as the app bar consumes it. Always a thunk returning a fresh array: a
 * menu's items are produced when it opens and never before, so no consumer has
 * to care which form the root model authored, and a plugin's contributions are
 * merged in at that point rather than spliced into the definition.
 */
export interface Menu {
  label: string
  menuItems: () => MenuItem[]
}

// a menu whose contributions have been collected but not yet applied
interface PendingMenu {
  label: string
  base: MenuItemsGetter
  itemActions: AddItemAction[]
}

// a contribution that threw is reported once rather than on every open — the
// menu re-resolves on each open and, while open, on each observer re-render
const reported = new WeakSet<AddItemAction>()

/**
 * The action log is permanent; the menu it builds is thrown away when the menu
 * closes. Everything a resolution walks therefore has to belong to the
 * throwaway, because resolving a path is a **write**:
 * `appendToSubMenu(['Add', 'My plugin'], two)` means "find the array labelled
 * My plugin and push into it".
 *
 * So when an earlier action is what supplied that array —
 * `appendToMenu('Add', { label: 'My plugin', subMenu: [one] })` — and it goes
 * into the menu by reference, the push lands in the stored action instead. The
 * next open replays a log that now reads `subMenu: [one, two]` and pushes
 * again, so the sub-menu gains an item on every open, and on every observer
 * re-render while open.
 *
 * Cloning is what keeps the two apart: the copy is what the path resolves to
 * and what gets written, and it dies with the open. Leaf items are shared by
 * reference — nothing writes into them — so this costs an allocation only for
 * the rows that nest.
 */
function cloneMenuItem(item: MenuItem): MenuItem {
  return 'subMenu' in item
    ? { ...item, subMenu: cloneMenuItems(resolveSubMenu(item)) }
    : item
}

function cloneMenuItems(items: MenuItem[]): MenuItem[] {
  return items.map(item => cloneMenuItem(item))
}

function materialize(menuItems: MenuItemsGetter) {
  return typeof menuItems === 'function' ? menuItems() : menuItems
}

// splice is already the "counts from the end when negative" rule, and clamps
// rather than wrapping past the start; the default is what makes it an append
function insertAt<T>(items: T[], item: T, position = items.length) {
  items.splice(position, 0, item)
}

/**
 * Walk `menuPath` past its first segment (the top-level menu, already
 * resolved), creating empty sub-menus as needed, and return the deepest
 * sub-menu's item array. Throws if a path segment names an item that is not a
 * sub-menu.
 */
function resolveMenuPath(items: MenuItem[], menuPath: string[]) {
  let level = items
  for (const [idx, menuName] of menuPath.slice(1).entries()) {
    let sub = level.find(
      (mi): mi is SubMenuItem => 'subMenu' in mi && mi.label === menuName,
    )
    if (!sub) {
      if (level.some(mi => 'label' in mi && mi.label === menuName)) {
        const pathSoFar = menuPath.slice(0, idx + 2).join(' > ')
        throw new Error(`"${menuName}" in path "${pathSoFar}" is not a subMenu`)
      }
      sub = { label: menuName, subMenu: [] }
      level.push(sub)
    }
    level = resolveSubMenu(sub)
  }
  return level
}

// each contribution is applied independently: a plugin that names a bad path
// loses its own item rather than every other plugin's, and never the session —
// this runs from the app bar's click handler, where a throw goes straight
// through React
function applyItemActions(items: MenuItem[], actions: AddItemAction[]) {
  for (const action of actions) {
    try {
      const target = resolveMenuPath(items, action.menuPath)
      // cloned rather than inserted by reference — see cloneMenuItem
      insertAt(target, cloneMenuItem(action.menuItem), action.position)
    } catch (error) {
      if (!reported.has(action)) {
        reported.add(action)
        console.error(error)
      }
    }
  }
  return items
}

// first menu with this label, or a new empty one — an item action naming a menu
// that doesn't exist creates it, so a plugin can populate its own menu without
// declaring it first
function findOrCreateMenu(
  pending: PendingMenu[],
  label: string,
  position?: number,
) {
  const found = pending.find(m => m.label === label)
  if (found) {
    return found
  }
  const menu: PendingMenu = { label, base: [], itemActions: [] }
  insertAt(pending, menu, position)
  return menu
}

function toMenu({ label, base, itemActions }: PendingMenu): Menu {
  return {
    label,
    menuItems: () =>
      applyItemActions(cloneMenuItems(materialize(base)), itemActions),
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
      case 'addMenu': {
        findOrCreateMenu(pending, action.menuName, action.position)
        break
      }
      case 'addItem': {
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
