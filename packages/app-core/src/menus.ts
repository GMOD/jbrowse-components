import type { MenuItem, SubMenuItem } from '@jbrowse/core/ui/menuItems'

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

/**
 * `addMenu` changes which menus exist, so it resolves eagerly — the app bar
 * renders one button per menu before anything is opened. `addItem` only changes
 * a menu's contents, so it resolves when that menu opens, against whatever its
 * items are at that moment.
 */
export type MenuAction = AddMenuAction | AddItemAction

/**
 * A top-level menu. `menuItems` is a thunk the app bar calls when the menu
 * opens and never before, so a root model's reads stay out of the bar's
 * tracking scope and a plugin's contributions are merged onto each fresh
 * result rather than spliced into a definition.
 */
export interface Menu {
  label: string
  menuItems: () => MenuItem[]
}

/**
 * The contributions to one level of one menu, in log order. A sub-menu is
 * entered the first time a contribution names it, so one that has to be created
 * lands where that contribution would have.
 */
interface ContributionNode {
  entries: (AddItemAction | SubMenuEntry)[]
}

interface SubMenuEntry {
  type: 'subMenu'
  label: string
  path: string[]
  node: ContributionNode
  first: AddItemAction
}

// a conflict is reported once rather than on every open — the menu re-resolves
// on each open and, while open, on each observer re-render — and the action is
// what outlives the nodes, which are rebuilt on every menus() evaluation
const reported = new WeakSet<AddItemAction>()

function register(
  node: ContributionNode,
  action: AddItemAction,
  depth: number,
) {
  const label = action.menuPath[depth]
  if (label === undefined) {
    node.entries.push(action)
  } else {
    let entry = node.entries.find(
      (e): e is SubMenuEntry => e.type === 'subMenu' && e.label === label,
    )
    if (!entry) {
      entry = {
        type: 'subMenu',
        label,
        path: action.menuPath.slice(0, depth + 1),
        node: { entries: [] },
        first: action,
      }
      node.entries.push(entry)
    }
    register(entry.node, action, depth + 1)
  }
}

// splice is already the "counts from the end when negative" rule, and clamps
// rather than wrapping past the start; the default is what makes it an append
function insertAt<T>(items: T[], item: T, position = items.length) {
  items.splice(position, 0, item)
}

// the author's form is kept: an array sub-menu resolves now, a thunk sub-menu
// resolves when its panel opens, with the contributions merged in either way
function withContributions(item: SubMenuItem, node: ContributionNode) {
  const { subMenu } = item
  return {
    ...item,
    subMenu:
      typeof subMenu === 'function'
        ? () => apply(subMenu(), node)
        : apply(subMenu, node),
  }
}

/**
 * Return a copy of `items` with a node's contributions merged in. Nothing is
 * written into `items`, into any sub-menu it holds, or into a contribution's
 * own payload: a sub-menu that gains contributions is replaced by a copy whose
 * `subMenu` resolves them, so the arrays behind a definition or an action are
 * the same on every open.
 *
 * A path segment naming a row that is not a sub-menu is a plugin bug. It
 * costs that subtree of contributions, reported once, and nothing else — this
 * runs from the app bar's click handler, where a throw goes straight through
 * React.
 */
function apply(items: MenuItem[], node: ContributionNode) {
  const result = [...items]
  for (const entry of node.entries) {
    if (entry.type === 'addItem') {
      insertAt(result, entry.menuItem, entry.position)
    } else {
      const idx = result.findIndex(
        mi => 'label' in mi && mi.label === entry.label,
      )
      const found = result[idx]
      if (found === undefined) {
        result.push({ label: entry.label, subMenu: apply([], entry.node) })
      } else if ('subMenu' in found) {
        result[idx] = withContributions(found, entry.node)
      } else if (!reported.has(entry.first)) {
        reported.add(entry.first)
        console.error(
          new Error(
            `"${entry.label}" in path "${entry.path.join(' > ')}" is not a subMenu`,
          ),
        )
      }
    }
  }
  return result
}

interface PendingMenu extends Menu {
  node: ContributionNode
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
  const menu: PendingMenu = {
    label,
    menuItems: () => [],
    node: { entries: [] },
  }
  insertAt(pending, menu, position)
  return menu
}

/**
 * Resolve a root model's menus against the contributions plugins have pushed
 * (via `RootAppMenuMixin`). Structural contributions apply now; item
 * contributions are grouped by path and merged when the menu they target
 * opens.
 *
 * Runs on every `menus()` evaluation, so it must not mutate `base` or anything
 * an action carries.
 */
export function processMutableMenuActions(
  base: Menu[],
  actions: MenuAction[],
): Menu[] {
  const pending = base.map(m => ({ ...m, node: { entries: [] } }))
  for (const action of actions) {
    switch (action.type) {
      case 'addMenu': {
        findOrCreateMenu(pending, action.menuName, action.position)
        break
      }
      case 'addItem': {
        register(findOrCreateMenu(pending, action.menuPath[0]!).node, action, 1)
        break
      }
      default: {
        action satisfies never
      }
    }
  }
  return pending.map(({ label, menuItems, node }) => ({
    label,
    menuItems: () => apply(menuItems(), node),
  }))
}

/**
 * Flatten resolved menus to plain data by opening every one of them. For tests
 * and other callers that want to assert on menu contents rather than render
 * them.
 */
export function resolveMenus(menus: Menu[]) {
  return menus.map(m => ({ label: m.label, menuItems: m.menuItems() }))
}
