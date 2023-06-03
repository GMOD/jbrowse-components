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
import { SessionWithDialogs } from '@jbrowse/product-core'

// locals
import { getSaveSession } from './Sessions'
import { DesktopRootModel } from '.'
import OpenSequenceDialog from '../components/OpenSequenceDialog'

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
export function DesktopMenusMixin(pluginManager: PluginManager) {
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
                        self.session?.notify(`${e}`)
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
}

export type DesktopMenusType = ReturnType<typeof DesktopMenusMixin>
export type DesktopMenus = Instance<DesktopMenusType>
