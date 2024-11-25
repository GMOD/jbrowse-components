import { types } from 'mobx-state-tree'
import type { MenuItem } from '@jbrowse/core/ui/Menu'

export interface Menu {
  label: string
  menuItems: MenuItem[]
}

/**
 * #stateModel RootAppMenuMixin
 */
export function RootAppMenuMixin() {
  return types.model({}).actions(s => {
    const self = s as { menus: Menu[] }
    return {
      /**
       * #action
       */
      setMenus(newMenus: Menu[]) {
        self.menus = newMenus
      },
      /**
       * #action
       * Add a top-level menu
       *
       * @param menuName - Name of the menu to insert.
       *
       * @returns The new length of the top-level menus array
       */
      appendMenu(menuName: string) {
        return self.menus.push({ label: menuName, menuItems: [] })
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
       * @returns The new length of the top-level menus array
       */
      insertMenu(menuName: string, position: number) {
        self.menus.splice(
          (position < 0 ? self.menus.length : 0) + position,
          0,
          {
            label: menuName,
            menuItems: [],
          },
        )
        return self.menus.length
      },
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
      appendToMenu(menuName: string, menuItem: MenuItem) {
        const menu = self.menus.find(m => m.label === menuName)
        if (!menu) {
          self.menus.push({ label: menuName, menuItems: [menuItem] })
          return 1
        }
        return menu.menuItems.push(menuItem)
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
       *
       * @returns The new length of the menu
       */
      insertInMenu(menuName: string, menuItem: MenuItem, position: number) {
        const menu = self.menus.find(m => m.label === menuName)
        if (!menu) {
          self.menus.push({ label: menuName, menuItems: [menuItem] })
          return 1
        }
        const insertPosition =
          position < 0 ? menu.menuItems.length + position : position
        menu.menuItems.splice(insertPosition, 0, menuItem)
        return menu.menuItems.length
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
        let topMenu = self.menus.find(m => m.label === menuPath[0])
        if (!topMenu) {
          const idx = this.appendMenu(menuPath[0]!)
          topMenu = self.menus[idx - 1]!
        }
        let { menuItems: subMenu } = topMenu
        const pathSoFar = [menuPath[0]]
        menuPath.slice(1).forEach(menuName => {
          pathSoFar.push(menuName)
          let sm = subMenu.find(mi => 'label' in mi && mi.label === menuName)
          if (!sm) {
            const idx = subMenu.push({ label: menuName, subMenu: [] })
            sm = subMenu[idx - 1]!
          }
          if (!('subMenu' in sm)) {
            throw new Error(
              `"${menuName}" in path "${pathSoFar}" is not a subMenu`,
            )
          }
          subMenu = sm.subMenu
        })
        return subMenu.push(menuItem)
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
       *
       * @returns The new length of the sub-menu
       */
      insertInSubMenu(
        menuPath: string[],
        menuItem: MenuItem,
        position: number,
      ) {
        let topMenu = self.menus.find(m => m.label === menuPath[0])
        if (!topMenu) {
          const idx = this.appendMenu(menuPath[0]!)
          topMenu = self.menus[idx - 1]!
        }
        let { menuItems: subMenu } = topMenu
        const pathSoFar = [menuPath[0]]
        menuPath.slice(1).forEach(menuName => {
          pathSoFar.push(menuName)
          let sm = subMenu.find(mi => 'label' in mi && mi.label === menuName)
          if (!sm) {
            const idx = subMenu.push({ label: menuName, subMenu: [] })
            sm = subMenu[idx - 1]!
          }
          if (!('subMenu' in sm)) {
            throw new Error(
              `"${menuName}" in path "${pathSoFar}" is not a subMenu`,
            )
          }
          subMenu = sm.subMenu
        })
        subMenu.splice(position, 0, menuItem)
        return subMenu.length
      },
    }
  })
}
