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
import { AssemblyManager } from '@jbrowse/plugin-data-management'

// locals
import { getSaveSession } from './Sessions'
import { DesktopRootModel } from '.'
import OpenSequenceDialog from '../components/OpenSequenceDialog'
import { AbstractSessionModel } from '@jbrowse/core/util'
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
              icon: OpenIcon,
              label: 'Open',
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
              icon: Save,
              label: 'Save',
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
              icon: SaveAs,
              label: 'Save as...',
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
              icon: DNA,
              label: 'Open assembly...',
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
              icon: StorageIcon,
              label: 'Open track...',
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
              icon: Cable,
              label: 'Open connection...',
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
              icon: AppsIcon,
              label: 'Return to start screen',
              onClick: () => {
                self.setSession(undefined)
              },
            },
            {
              icon: MeetingRoomIcon,
              label: 'Exit',
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
              icon: UndoIcon,
              label: 'Undo',
              onClick: () => {
                if (self.history.canUndo) {
                  self.history.undo()
                }
              },
            },
            {
              icon: RedoIcon,
              label: 'Redo',
              onClick: () => {
                if (self.history.canRedo) {
                  self.history.redo()
                }
              },
            },
            { type: 'divider' },
            {
              icon: ExtensionIcon,
              label: 'Plugin store',
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
              icon: SettingsIcon,
              label: 'Preferences',
              onClick: () => {
                if (self.session) {
                  const session = self.session as SessionWithDialogs
                  session.queueDialog(handleClose => [
                    PreferencesDialog,
                    {
                      handleClose,
                      session: self.session,
                    },
                  ])
                }
              },
            },
            {
              icon: SettingsIcon,
              label: 'Open assembly manager',
              onClick: () => {
                ;(self.session as AbstractSessionModel).queueDialog(
                  handleClose => [
                    AssemblyManager,
                    { onClose: handleClose, rootModel: self },
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
