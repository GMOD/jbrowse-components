import { pushIntoSubMenu } from '../ui/launchViewMenu.ts'
import { extendDisplayType, extendViewType } from './extendElementType.ts'

import type PluginManager from '../PluginManager.ts'
import type {
  DisplayTypeName,
  DisplayTypeRegistry,
  ViewTypeName,
  ViewTypeRegistry,
} from '../PluginManager.ts'
import type { MenuItem } from '../ui/MenuTypes.ts'
import type {
  IAnyModelType,
  IAnyType,
  Instance,
} from '@jbrowse/mobx-state-tree'

/**
 * The instance a registry entry's state model produces. The registries are
 * declared empty here and filled by module augmentation, so inside this package
 * every one of these resolves to `never` — see {@link extendViewType} for why
 * that is fine and what the caller gets instead.
 */
type ModelOf<T> = T extends IAnyType ? Instance<T> : never

/**
 * The methods on a model that return a menu. Derived from the model rather than
 * listed, which is what makes a renamed or retired method a compile error at
 * the call site: there are six of them across views and displays (`menuItems`,
 * `trackMenuItems`, `contextMenuItems`, `rubberBandMenuItems`,
 * `rubberBandLaunchMenuItems`, `highlightMenuItems`), they are a convention
 * rather than one declared interface, and a contribution to a name the model no
 * longer has is otherwise silent.
 *
 * Given several names, `M` arrives as the union of their models and `keyof M`
 * is what they share, so a menu only one of them has is a compile error rather
 * than a `self[menu]` that is undefined on the others.
 */
type MenuMethodName<M> = {
  [K in keyof M]: M[K] extends (...args: never[]) => MenuItem[] ? K : never
}[keyof M]

/**
 * What a contributor is handed: the model, plus whatever the menu method itself
 * takes (`highlightMenuItems` gets the highlight). Returning `undefined` adds
 * nothing, which is how a contribution scoped to some state opts out.
 */
type MenuItemsCallback<M, K extends keyof M> = (
  model: M,
  ...args: M[K] extends (...args: infer A) => unknown ? A : never
) => MenuItem | MenuItem[] | undefined

interface MenuItemsOptions<M, K extends keyof M> {
  /** which menu to add to */
  menu: K
  /**
   * a submenu label to collect the items under, e.g. `LAUNCH_VIEW_LABEL`. The
   * submenu is created once and shared, so several plugins naming the same
   * group land in one place rather than each adding a top-level row
   */
  group?: string
  items: MenuItemsCallback<M, K>
}

// The shared fold. Both entry points are thin wrappers rather than overloads of
// one function: with overloads, a `menu` the model does not have stops matching
// the view signature, falls through to the display one, and reports as "'view'
// does not exist in type …" — an error about the wrong parameter, for a mistake
// this helper exists to name precisely.
function menuExtension(
  menu: string,
  group: string | undefined,
  items: (model: never, ...args: never[]) => MenuItem | MenuItem[] | undefined,
) {
  return (stateModel: IAnyModelType) =>
    stateModel.views(
      (self: Record<string, (...args: unknown[]) => MenuItem[]>) => {
        const superMenu = self[menu]!
        return {
          // Copied rather than pushed into: `group` reaches inside an item the
          // method before us built, and the array it came from is this call's
          // to change, not one an earlier caller is still holding.
          [menu](...args: unknown[]) {
            const built = [...superMenu(...args)]
            const contributed = (
              items as (
                model: unknown,
                ...args: unknown[]
              ) => MenuItem | MenuItem[] | undefined
            )(self, ...args)
            if (contributed !== undefined) {
              for (const item of Array.isArray(contributed)
                ? contributed
                : [contributed]) {
                if (group === undefined) {
                  built.push(item)
                } else {
                  pushIntoSubMenu(built, group, item)
                }
              }
            }
            return built
          },
        }
      },
    )
}

/**
 * Add items to a menu on a view type belonging to another plugin, e.g. an "open
 * a synteny view on this locus" entry on the linear genome view. Pass an array
 * to contribute the same items to several types at once.
 *
 * Prefer this to extending the state model by hand. The model is the right seam
 * — `menuItems()` is called from seven pieces of view chrome, and only the model
 * reaches all of them — but writing the extension out means `stateModel.views`,
 * capturing the previous method, spreading it, and remembering to return the
 * whole array. Each of those is silent when it goes wrong, and the middle one
 * costs every plugin registered earlier its items.
 *
 * ```ts
 * addViewMenuItems(pluginManager, 'LinearGenomeView', {
 *   menu: 'rubberBandLaunchMenuItems',
 *   items: self => ({ label: 'Consensus sequence', onClick: () => {} }),
 * })
 * ```
 *
 * A contribution needing state or actions of its own is still a model
 * extension: use {@link extendViewType} and add the menu items in the same
 * `.views` block, so the items and the actions they call stay together.
 */
export function addViewMenuItems<
  N extends ViewTypeName,
  K extends MenuMethodName<ModelOf<ViewTypeRegistry[N]>>,
>(
  pluginManager: PluginManager,
  name: N | readonly N[],
  options: MenuItemsOptions<ModelOf<ViewTypeRegistry[N]>, K>,
) {
  const { menu, group, items } = options
  extendViewType(
    pluginManager,
    name,
    menuExtension(menu as string, group, items as never),
  )
}

/**
 * Add items to a menu on a display type belonging to another plugin, e.g. an
 * "open this read in a dotplot" entry on the alignments display's context menu.
 * See {@link addViewMenuItems}; the name is checked against
 * `DisplayTypeRegistry`.
 *
 * ```ts
 * addDisplayMenuItems(pluginManager, 'LinearAlignmentsDisplay', {
 *   menu: 'contextMenuItems',
 *   group: LAUNCH_VIEW_LABEL,
 *   items: self =>
 *     self.contextMenuFeatureId === undefined
 *       ? undefined
 *       : { label: 'Dotplot of read vs ref', onClick: () => {} },
 * })
 * ```
 */
export function addDisplayMenuItems<
  N extends DisplayTypeName,
  K extends MenuMethodName<ModelOf<DisplayTypeRegistry[N]>>,
>(
  pluginManager: PluginManager,
  name: N | readonly N[],
  options: MenuItemsOptions<ModelOf<DisplayTypeRegistry[N]>, K>,
) {
  const { menu, group, items } = options
  extendDisplayType(
    pluginManager,
    name,
    menuExtension(menu as string, group, items as never),
  )
}
