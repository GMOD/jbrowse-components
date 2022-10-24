import {
  addDisposer,
  cast,
  getSnapshot,
  types,
  SnapshotIn,
  Instance,
} from 'mobx-state-tree'
import { autorun } from 'mobx'
import {
  addUndoKeyboardShortcuts,
  initUndoModel,
  initInternetAccounts,
  undoMenuItems,
  extendMenuModel,
  extendAuthenticationModel,
} from '@jbrowse/app-core'
import assemblyManagerFactory from '@jbrowse/core/assemblyManager'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import TimeTraveller from '@jbrowse/core/util/TimeTraveller'
import { MenuItem } from '@jbrowse/core/ui'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

// icons
import OpenIcon from '@mui/icons-material/FolderOpen'
import ExtensionIcon from '@mui/icons-material/Extension'
import AppsIcon from '@mui/icons-material/Apps'
import StorageIcon from '@mui/icons-material/Storage'
import SettingsIcon from '@mui/icons-material/Settings'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import { Save, SaveAs, DNA, Cable } from '@jbrowse/core/ui/Icons'

// locals
import makeWorkerInstance from './makeWorkerInstance'
import sessionModelFactory from './sessionModelFactory'
import jobsModelFactory from './indexJobsModel'
import JBrowseDesktop from './jbrowseModel'
import OpenSequenceDialog from './OpenSequenceDialog'

const { ipcRenderer } = window.require('electron')

function getSaveSession(model: RootModel) {
  return {
    ...getSnapshot(model.jbrowse),
    defaultSession: model.session ? getSnapshot(model.session) : {},
  }
}

interface Menu {
  label: string
  menuItems: MenuItem[]
}

export default function rootModelFactory(pluginManager: PluginManager) {
  const Assembly = assemblyConfigSchemaFactory(pluginManager)
  const Session = sessionModelFactory(pluginManager, Assembly)
  const JobsManager = jobsModelFactory(pluginManager)
  const AssemblyManager = assemblyManagerFactory(Assembly, pluginManager)
  const rootModel = types
    .model('Root', {
      jbrowse: JBrowseDesktop(pluginManager, Session, Assembly),
      session: types.maybe(Session),
      jobsManager: types.maybe(JobsManager),
      assemblyManager: types.optional(AssemblyManager, {}),
      savedSessionNames: types.maybe(types.array(types.string)),
      version: types.maybe(types.string),
      internetAccounts: types.array(
        pluginManager.pluggableMstType('internet account', 'stateModel'),
      ),
      sessionPath: types.optional(types.string, ''),
      history: types.optional(TimeTraveller, { targetPath: '../session' }),
    })
    .volatile(() => ({
      isAssemblyEditing: false,
      error: undefined as unknown,
      textSearchManager: new TextSearchManager(pluginManager),
      openNewSessionCallback: async (_path: string) => {
        console.error('openNewSessionCallback unimplemented')
      },
      pluginManager,
    }))
    .actions(self => ({
      async saveSession(val: unknown) {
        if (self.sessionPath) {
          await ipcRenderer.invoke('saveSession', self.sessionPath, val)
        }
      },
      setOpenNewSessionCallback(cb: (arg: string) => Promise<void>) {
        self.openNewSessionCallback = cb
      },
      setSavedSessionNames(sessionNames: string[]) {
        self.savedSessionNames = cast(sessionNames)
      },
      setSessionPath(path: string) {
        self.sessionPath = path
      },
      setSession(sessionSnapshot?: SnapshotIn<typeof Session>) {
        self.session = cast(sessionSnapshot)
      },
      setError(error: unknown) {
        self.error = error
      },
      setDefaultSession() {
        this.setSession(self.jbrowse.defaultSession)
      },
      setAssemblyEditing(flag: boolean) {
        self.isAssemblyEditing = flag
      },

      async renameCurrentSession(newName: string) {
        if (self.session) {
          this.setSession({ ...getSnapshot(self.session), name: newName })
        }
      },
      duplicateCurrentSession() {
        if (self.session) {
          const snapshot = JSON.parse(JSON.stringify(getSnapshot(self.session)))
          let newSnapshotName = `${self.session.name} (copy)`
          if (self.jbrowse.savedSessionNames.includes(newSnapshotName)) {
            let newSnapshotCopyNumber = 2
            do {
              newSnapshotName = `${self.session.name} (copy ${newSnapshotCopyNumber})`
              newSnapshotCopyNumber += 1
            } while (self.jbrowse.savedSessionNames.includes(newSnapshotName))
          }
          snapshot.name = newSnapshotName
          this.setSession(snapshot)
        }
      },
    }))
    .volatile(self => ({
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
                    await self.saveSession(getSaveSession(self as RootModel))
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
                  await self.saveSession(getSaveSession(self as RootModel))
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
                  self.session.queueDialog(doneCallback => [
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
                } else if (session.views.length >= 1) {
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
              onClick: () => ipcRenderer.invoke('quit'),
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
            ...undoMenuItems(self),
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
              label: 'Open assembly manager',
              icon: SettingsIcon,
              onClick: () => {
                self.setAssemblyEditing(true)
              },
            },
          ],
        },
      ] as Menu[],
      rpcManager: new RpcManager(
        pluginManager,
        self.jbrowse.configuration.rpc,
        {
          WebWorkerRpcDriver: {
            makeWorkerInstance,
          },
          MainThreadRpcDriver: {},
        },
      ),
      adminMode: true,
    }))
    .actions(self => ({
      activateSession(sessionSnapshot: SnapshotIn<typeof Session>) {
        self.setSession(sessionSnapshot)
      },

      async setPluginsUpdated() {
        if (self.session) {
          await self.saveSession(getSaveSession(self as RootModel))
        }
        await self.openNewSessionCallback(self.sessionPath)
      },

      afterCreate() {
        initUndoModel(self)
        initInternetAccounts(self)
        addUndoKeyboardShortcuts(self)

        addDisposer(
          self,
          autorun(
            async () => {
              if (!self.session) {
                return
              }
              try {
                await self.saveSession(getSaveSession(self as RootModel))
              } catch (e) {
                console.error(e)
              }
            },
            { delay: 1000 },
          ),
        )
      },
    }))

  return extendMenuModel(extendAuthenticationModel(rootModel, pluginManager))
}

export type RootModelType = ReturnType<typeof rootModelFactory>
export type RootModel = Instance<RootModelType>
