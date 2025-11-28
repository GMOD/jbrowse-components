import { types } from '@jbrowse/mobx-state-tree'

import type { Menu, MenuAction } from '../menus'
import type { MenuItem } from '@jbrowse/core/ui/Menu'

/**
 * #stateModel RootAppMenuMixin
 */
export function RootAppMenuMixin() {
  return types
    .model({})
    .volatile(() => ({
      mutableMenuActions: [] as MenuAction[],
    }))
    .actions(self => ({
      /**
       * #action
       */
      setMenus(newMenus: Menu[]) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'setMenus', newMenus },
        ]
      },
      /**
       * #action
       * Add a top-level menu
       *
       * @param menuName - Name of the menu to insert.
       *
       */
      appendMenu(menuName: string) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          { type: 'appendMenu', menuName },
        ]
      },
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
       */
      insertMenu(menuName: string, position: number) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          {
            type: 'insertMenu',
            menuName,
            position,
          },
        ]
      },
      /**
       * #action
       * Add a menu item to a top-level menu
       *
       * @param menuName - Name of the top-level menu to append to.
       *
       * @param menuItem - Menu item to append.
       */
      appendToMenu(menuName: string, menuItem: MenuItem) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          {
            type: 'appendToMenu',
            menuName,
            menuItem,
          },
        ]
      },
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
       */
      insertInMenu(menuName: string, menuItem: MenuItem, position: number) {
        self.mutableMenuActions.push({
          type: 'insertInMenu',
          menuName,
          menuItem,
          position,
        })
      },
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
      appendToSubMenu(menuPath: string[], menuItem: MenuItem) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          {
            type: 'appendToSubMenu',
            menuPath,
            menuItem,
          },
        ]
      },
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
      insertInSubMenu(
        menuPath: string[],
        menuItem: MenuItem,
        position: number,
      ) {
        self.mutableMenuActions = [
          ...self.mutableMenuActions,
          {
            type: 'insertInSubMenu',
            menuPath,
            menuItem,
            position,
          },
        ]
      },
    }))
}
