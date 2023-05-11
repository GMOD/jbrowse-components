import PluginManager from '@jbrowse/core/PluginManager'
import { Instance, types } from 'mobx-state-tree'
import { lazy } from 'react'

// icons
import OpenIcon from '@mui/icons-material/FolderOpen'
import ExtensionIcon from '@mui/icons-material/Extension'
import AppsIcon from '@mui/icons-material/Apps'
import StorageIcon from '@mui/icons-material/Storage'
import SettingsIcon from '@mui/icons-material/Settings'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'

import type { MenuItem } from '@jbrowse/core/ui'
import { Save, SaveAs, DNA, Cable } from '@jbrowse/core/ui/Icons'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

import OpenSequenceDialog from '../OpenSequenceDialog'
import type { SessionWithDialogs } from '@jbrowse/product-core/src/Session/DialogQueue'
import { getSaveSession } from './Sessions'
import { DesktopRootModel } from '.'

const PreferencesDialog = lazy(() => import('../PreferencesDialog'))
const { ipcRenderer } = window.require('electron')

export interface Menu {
  label: string
  menuItems: MenuItem[]
}

/**
 * #stateModel DesktopMenusMixin
 */
export default function Menus(pluginManager: PluginManager) {
  return types
    .model({})
    .volatile(s => {
      const self = s as DesktopRootModel
      return {
        menus: [
          {
            label: 'File',
            menuItems: [
              {
                label: 'Open',
                icon: OpenIcon,
                onClick: async () => {
                  try {
                    const path = await ipcRenderer.invoke('promptOpenFile')
                    if (path) {
                      await self.openNewSessionCallback(path)
                    }
                  } catch (e) {
                    console.error(e)
                    self.session?.notify(`${e}`, 'error')
                  }
                },
              },
              {
                label: 'Save',
                icon: Save,
                onClick: async () => {
                  if (self.session) {
                    try {
                      await self.saveSession(getSaveSession(self))
                    } catch (e) {
                      console.error(e)
                      self.session?.notify(`${e}`, 'error')
                    }
                  }
                },
              },
              {
                label: 'Save as...',
                icon: SaveAs,
                onClick: async () => {
                  try {
                    const saveAsPath = await ipcRenderer.invoke(
                      'promptSessionSaveAs',
                    )
                    self.setSessionPath(saveAsPath)
                    await self.saveSession(getSaveSession(self))
                  } catch (e) {
                    console.error(e)
                    self.session?.notify(`${e}`, 'error')
                  }
                },
              },
              {
                type: 'divider',
              },
              {
                label: 'Open assembly...',
                icon: DNA,
                onClick: () => {
                  if (self.session) {
                    const session = self.session as SessionWithDialogs
                    session.queueDialog(doneCallback => [
                      OpenSequenceDialog,
                      {
                        model: self,
                        onClose: (confs: AnyConfigurationModel[]) => {
                          try {
                            confs?.forEach(conf => {
                              self.jbrowse.addAssemblyConf(conf)
                            })
                          } catch (e) {
                            console.error(e)
                            self.session?.notify(`${e}`)
                          }
                          doneCallback()
                        },
                      },
                    ])
                  }
                },
              },
              {
                label: 'Open track...',
                icon: StorageIcon,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick: (session: any) => {
                  if (session.views.length === 0) {
                    session.notify('Please open a view to add a track first')
                  } else if (session.views.length > 0) {
                    const widget = session.addWidget(
                      'AddTrackWidget',
                      'addTrackWidget',
                      { view: session.views[0].id },
                    )
                    session.showWidget(widget)
                    if (session.views.length > 1) {
                      session.notify(
                        `This will add a track to the first view. Note: if you want to open a track in a specific view open the track selector for that view and use the add track (plus icon) in the bottom right`,
                      )
                    }
                  }
                },
              },
              {
                label: 'Open connection...',
                icon: Cable,
                onClick: () => {
                  if (self.session) {
                    const widget = self.session.addWidget(
                      'AddConnectionWidget',
                      'addConnectionWidget',
                    )
                    self.session.showWidget(widget)
                  }
                },
              },
              {
                type: 'divider',
              },
              {
                label: 'Return to start screen',
                icon: AppsIcon,
                onClick: () => {
                  self.setSession(undefined)
                },
              },
              {
                label: 'Exit',
                icon: MeetingRoomIcon,
                onClick: async () => {
                  await ipcRenderer.invoke('quit')
                },
              },
            ],
          },
          {
            label: 'Add',
            menuItems: [],
          },
          {
            label: 'Tools',
            menuItems: [
              {
                label: 'Undo',
                icon: UndoIcon,
                onClick: () => {
                  if (self.history.canUndo) {
                    self.history.undo()
                  }
                },
              },
              {
                label: 'Redo',
                icon: RedoIcon,
                onClick: () => {
                  if (self.history.canRedo) {
                    self.history.redo()
                  }
                },
              },
              { type: 'divider' },
              {
                label: 'Plugin store',
                icon: ExtensionIcon,
                onClick: () => {
                  if (self.session) {
                    const widget = self.session.addWidget(
                      'PluginStoreWidget',
                      'pluginStoreWidget',
                    )
                    self.session.showWidget(widget)
                  }
                },
              },
              {
                label: 'Preferences',
                icon: SettingsIcon,
                onClick: () => {
                  if (self.session) {
                    const session = self.session as SessionWithDialogs
                    session.queueDialog(handleClose => [
                      PreferencesDialog,
                      {
                        session: self.session,
                        handleClose,
                      },
                    ])
                  }
                },
              },
              {
                label: 'Open assembly manager',
                icon: SettingsIcon,
                onClick: () => {
                  self.setAssemblyEditing(true)
                },
              },
            ],
          },
        ] as Menu[],
      }
    })
    .actions(self => ({
      /**
       * #action
       */
      setMenus(newMenus: Menu[]) {
        self.menus = newMenus
      },
      async setPluginsUpdated() {
        const root = self as DesktopRootModel
        if (root.session) {
          await root.saveSession(getSaveSession(root))
        }
        await root.openNewSessionCallback(root.sessionPath)
      },
      /**
       * #action
       * Add a top-level menu
       * @param menuName - Name of the menu to insert.
       * @returns The new length of the top-level menus array
       */
      appendMenu(menuName: string) {
        return self.menus.push({ label: menuName, menuItems: [] })
      },
      /**
       * #action
       * Insert a top-level menu
       * @param menuName - Name of the menu to insert.
       * @param position - Position to insert menu. If negative, counts from th
       * end, e.g. `insertMenu('My Menu', -1)` will insert the menu as the
       * second-to-last one.
       * @returns The new length of the top-level menus array
       */
      insertMenu(menuName: string, position: number) {
        const insertPosition =
          position < 0 ? self.menus.length + position : position
        self.menus.splice(insertPosition, 0, { label: menuName, menuItems: [] })
        return self.menus.length
      },
      /**
       * #action
       * Add a menu item to a top-level menu
       * @param menuName - Name of the top-level menu to append to.
       * @param menuItem - Menu item to append.
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
       * @param menuName - Name of the top-level menu to insert into
       * @param menuItem - Menu item to insert
       * @param position - Position to insert menu item. If negative, counts
       * from the end, e.g. `insertMenu('My Menu', -1)` will insert the menu as
       * the second-to-last one.
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
       * @param menuPath - Path to the sub-menu to add to, starting with the
       * top-level menu (e.g. `['File', 'Insert']`).
       * @param menuItem - Menu item to append.
       * @returns The new length of the sub-menu
       */
      appendToSubMenu(menuPath: string[], menuItem: MenuItem) {
        let topMenu = self.menus.find(m => m.label === menuPath[0])
        if (!topMenu) {
          const idx = this.appendMenu(menuPath[0])
          topMenu = self.menus[idx - 1]
        }
        let { menuItems: subMenu } = topMenu
        const pathSoFar = [menuPath[0]]
        menuPath.slice(1).forEach(menuName => {
          pathSoFar.push(menuName)
          let sm = subMenu.find(mi => 'label' in mi && mi.label === menuName)
          if (!sm) {
            const idx = subMenu.push({ label: menuName, subMenu: [] })
            sm = subMenu[idx - 1]
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
       * @param menuPath - Path to the sub-menu to add to, starting with the
       * top-level menu (e.g. `['File', 'Insert']`).
       * @param menuItem - Menu item to insert.
       * @param position - Position to insert menu item. If negative, counts
       * from the end, e.g. `insertMenu('My Menu', -1)` will insert the menu as
       * the second-to-last one.
       * @returns The new length of the sub-menu
       */
      insertInSubMenu(
        menuPath: string[],
        menuItem: MenuItem,
        position: number,
      ) {
        let topMenu = self.menus.find(m => m.label === menuPath[0])
        if (!topMenu) {
          const idx = this.appendMenu(menuPath[0])
          topMenu = self.menus[idx - 1]
        }
        let { menuItems: subMenu } = topMenu
        const pathSoFar = [menuPath[0]]
        menuPath.slice(1).forEach(menuName => {
          pathSoFar.push(menuName)
          let sm = subMenu.find(mi => 'label' in mi && mi.label === menuName)
          if (!sm) {
            const idx = subMenu.push({ label: menuName, subMenu: [] })
            sm = subMenu[idx - 1]
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
    }))
}

export type DesktopMenusType = ReturnType<typeof Menus>
export type DesktopMenus = Instance<DesktopMenusType>
