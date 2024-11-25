import { lazy } from 'react'

// icons

import { Save, SaveAs, DNA, Cable } from '@jbrowse/core/ui/Icons'
import { AssemblyManager } from '@jbrowse/plugin-data-management'
import AppsIcon from '@mui/icons-material/Apps'
import ExtensionIcon from '@mui/icons-material/Extension'
import OpenIcon from '@mui/icons-material/FolderOpen'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import RedoIcon from '@mui/icons-material/Redo'
import SettingsIcon from '@mui/icons-material/Settings'
import StorageIcon from '@mui/icons-material/Storage'
import UndoIcon from '@mui/icons-material/Undo'
import { types } from 'mobx-state-tree'

// locals
import { getSaveSession } from './Sessions'
import OpenSequenceDialog from '../components/OpenSequenceDialog'
import type { DesktopRootModel } from '.'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { SessionWithDialogs } from '@jbrowse/product-core'
import type { Instance } from 'mobx-state-tree'
const PreferencesDialog = lazy(() => import('../components/PreferencesDialog'))
const { ipcRenderer } = window.require('electron')

export interface Menu {
  label: string
  menuItems: MenuItem[]
}

/**
 * #stateModel DesktopMenusMixin
 * #category root
 */
export function DesktopMenusMixin(_pluginManager: PluginManager) {
  return types.model({}).volatile(s => {
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
                  self.session?.notifyError(`${e}`, e)
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
                    self.session?.notifyError(`${e}`, e)
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
                  self.session?.notifyError(`${e}`, e)
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
                if (!self.session) {
                  return
                }
                const session = self.session as SessionWithDialogs
                session.queueDialog(doneCallback => [
                  OpenSequenceDialog,
                  {
                    model: self,
                    onClose: (confs?: AnyConfigurationModel[]) => {
                      try {
                        confs?.forEach(conf => {
                          self.jbrowse.addAssemblyConf(conf)
                        })
                      } catch (e) {
                        console.error(e)
                        self.session?.notifyError(`${e}`, e)
                      }
                      doneCallback()
                    },
                  },
                ])
              },
            },
            {
              label: 'Open track...',
              icon: StorageIcon,

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
                      'This will add a track to the first view. Note: if you want to open a track in a specific view open the track selector for that view and use the add track (plus icon) in the bottom right',
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
                ;(self.session as AbstractSessionModel).queueDialog(
                  handleClose => [
                    AssemblyManager,
                    { rootModel: self, onClose: handleClose },
                  ],
                )
              },
            },
          ],
        },
      ] as Menu[],
    }
  })
}

export type DesktopMenusType = ReturnType<typeof DesktopMenusMixin>
export type DesktopMenus = Instance<DesktopMenusType>
