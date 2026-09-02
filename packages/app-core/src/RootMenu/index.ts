import { types } from '@jbrowse/mobx-state-tree'

import type { MenuAction } from '../menus.ts'
import type { MenuItem } from '@jbrowse/core/ui/menuItems'

/**
 * #stateModel RootAppMenuMixin
 */
export function RootAppMenuMixin() {
  return types
    .model({})
    .volatile(() => ({
      // array reference is replaced (not mutated) so MobX observers detect the change
      mutableMenuActions: [] as MenuAction[],
    }))
    .actions(self => {
      function pushAction(action: MenuAction) {
        self.mutableMenuActions = [...self.mutableMenuActions, action]
      }
      return {
        /**
         * #action
         * Add a top-level menu, if the app bar does not already have one with
         * this name.
         *
         * @param menuName - Name of the menu to add.
         */
        appendMenu(menuName: string) {
          pushAction({ type: 'addMenu', menuName })
        },
        /**
         * #action
         * Insert a top-level menu, if the app bar does not already have one
         * with this name.
         *
         * @param menuName - Name of the menu to insert.
         *
         * @param position - Position to insert menu. If negative, counts from the
         * end, e.g. `insertMenu('My Menu', -1)` will insert the menu as the
         * second-to-last one.
         */
        insertMenu(menuName: string, position: number) {
          pushAction({ type: 'addMenu', menuName, position })
        },
        /**
         * #action
         * Add a menu item to a top-level menu, creating the menu if it does not
         * exist.
         *
         * @param menuName - Name of the top-level menu to append to.
         *
         * @param menuItem - Menu item to append.
         */
        appendToMenu(menuName: string, menuItem: MenuItem) {
          pushAction({ type: 'addItem', menuPath: [menuName], menuItem })
        },
        /**
         * #action
         * Insert a menu item into a top-level menu, creating the menu if it
         * does not exist.
         *
         * @param menuName - Name of the top-level menu to insert into
         *
         * @param menuItem - Menu item to insert
         *
         * @param position - Position to insert menu item. If negative, counts
         * from the end, e.g. `insertInMenu('My Menu', item, -1)` will insert the
         * item as the second-to-last one.
         */
        insertInMenu(menuName: string, menuItem: MenuItem, position: number) {
          pushAction({
            type: 'addItem',
            menuPath: [menuName],
            menuItem,
            position,
          })
        },
        /**
         * #action
         * Add a menu item to a sub-menu, creating any part of the path that
         * does not exist.
         *
         * @param menuPath - Path to the sub-menu to add to, starting with the
         * top-level menu (e.g. `['File', 'Insert']`).
         *
         * @param menuItem - Menu item to append.
         */
        appendToSubMenu(menuPath: string[], menuItem: MenuItem) {
          pushAction({ type: 'addItem', menuPath, menuItem })
        },
        /**
         * #action
         * Insert a menu item into a sub-menu, creating any part of the path
         * that does not exist.
         *
         * @param menuPath - Path to the sub-menu to add to, starting with the
         * top-level menu (e.g. `['File', 'Insert']`).
         *
         * @param menuItem - Menu item to insert.
         *
         * @param position - Position to insert menu item. If negative, counts
         * from the end, e.g. `insertInSubMenu(path, item, -1)` will insert the
         * item as the second-to-last one.
         */
        insertInSubMenu(
          menuPath: string[],
          menuItem: MenuItem,
          position: number,
        ) {
          pushAction({ type: 'addItem', menuPath, menuItem, position })
        },
      }
    })
}
