import {
  addDisposer,
  cast,
  resolveIdentifier,
  getSnapshot,
  types,
  SnapshotIn,
  Instance,
} from 'mobx-state-tree'
import { autorun, observable, toJS } from 'mobx'

import assemblyManagerFactory from '@jbrowse/core/assemblyManager'
import assemblyConfigSchemaFactory from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import RpcManager from '@jbrowse/core/rpc/RpcManager'
import { MenuItem } from '@jbrowse/core/ui'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import { UriLocation } from '@jbrowse/core/util/types'
import { supportedIndexingAdapters } from '@jbrowse/text-indexing'
import { ipcRenderer } from 'electron'

// icons
import OpenIcon from '@material-ui/icons/FolderOpen'
import ExtensionIcon from '@material-ui/icons/Extension'
import AppsIcon from '@material-ui/icons/Apps'
import StorageIcon from '@material-ui/icons/Storage'
import SettingsIcon from '@material-ui/icons/Settings'
import MeetingRoomIcon from '@material-ui/icons/MeetingRoom'
import { Save, SaveAs, DNA, Cable } from '@jbrowse/core/ui/Icons'

// locals
import sessionModelFactory from './sessionModelFactory'
import JBrowseDesktop from './jbrowseModel'
import OpenSequenceDialog from './OpenSequenceDialog'
// import { IndexTracksRpcMethod } from './IndexTracksRpcMethod'
// @ts-ignore
import RenderWorker from './rpc.worker'

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

interface Track {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}
interface TrackTextIndexing {
  attributes: string[]
  exclude: string[]
  assemblies: string[]
  tracks: string[] // trackIds
  indexType: string
}

export default function rootModelFactory(pluginManager: PluginManager) {
  const assemblyConfigSchema = assemblyConfigSchemaFactory(pluginManager)
  const Session = sessionModelFactory(pluginManager, assemblyConfigSchema)
  return types
    .model('Root', {
      jbrowse: JBrowseDesktop(pluginManager, Session, assemblyConfigSchema),
      session: types.maybe(Session),
      assemblyManager: assemblyManagerFactory(
        assemblyConfigSchema,
        pluginManager,
      ),
      savedSessionNames: types.maybe(types.array(types.string)),
      version: types.maybe(types.string),
      internetAccounts: types.array(
        pluginManager.pluggableMstType('internet account', 'stateModel'),
      ),
      isAssemblyEditing: false,
      sessionPath: types.optional(types.string, ''),
    })
    .volatile(() => ({
      indexingStatus: 0 as number,
      running: false,
      error: undefined as unknown,
      textSearchManager: new TextSearchManager(pluginManager),
      openNewSessionCallback: async (path: string) => {
        console.error('openNewSessionCallback unimplemented')
      },
      pluginManager,
      indexingQueue: observable.array([] as TrackTextIndexing[]),
      finishedJobs: observable.array([] as TrackTextIndexing[]),
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
      setRunning(running: boolean) {
        self.running = running
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
      initializeInternetAccount(
        internetAccountId: string,
        initialSnapshot = {},
      ) {
        const internetAccountConfigSchema =
          pluginManager.pluggableConfigSchemaType('internet account')
        const configuration = resolveIdentifier(
          internetAccountConfigSchema,
          self,
          internetAccountId,
        )

        const internetAccountType = pluginManager.getInternetAccountType(
          configuration.type,
        )
        if (!internetAccountType) {
          throw new Error(`unknown internet account type ${configuration.type}`)
        }

        const internetAccount = internetAccountType.stateModel.create({
          ...initialSnapshot,
          type: configuration.type,
          configuration,
        })
        self.internetAccounts.push(internetAccount)
        return internetAccount
      },
      createEphemeralInternetAccount(
        internetAccountId: string,
        initialSnapshot = {},
        url: string,
      ) {
        let hostUri

        try {
          hostUri = new URL(url).origin
        } catch (e) {
          // ignore
        }
        // id of a custom new internaccount is `${type}-${name}`
        const internetAccountSplit = internetAccountId.split('-')
        const configuration = {
          type: internetAccountSplit[0],
          internetAccountId: internetAccountId,
          name: internetAccountSplit.slice(1).join('-'),
          description: '',
          domains: [hostUri],
        }
        const internetAccountType = pluginManager.getInternetAccountType(
          configuration.type,
        )
        const internetAccount = internetAccountType.stateModel.create({
          ...initialSnapshot,
          type: configuration.type,
          configuration,
        })
        self.internetAccounts.push(internetAccount)
        return internetAccount
      },
      queueIndexingJob(props: TrackTextIndexing) {
        self.indexingQueue.push(props)
      },
      dequeueIndexingJob() {
        const entry = self.indexingQueue.splice(0, 1)
        self.finishedJobs.push(...entry)
      },
      setIndexingStatus(arg: string) {
        const progress = arg ? +arg : 0
        self.indexingStatus = progress
      },
      async runIndexingJob() {
        if (self.indexingQueue.length) {
          const firstIndexingJob = self.indexingQueue[0] as TrackTextIndexing
          const {
            tracks: trackIds,
            exclude,
            attributes,
            assemblies,
            indexType,
          } = toJS(firstIndexingJob)
          const rpcManager = self.jbrowse.rpcManager
          const trackConfigs = this.findTrackConfigsToIndex(trackIds)
          try {
            this.setRunning(true)
            await rpcManager.call(
              'indexTracksSessionId',
              'TextIndexRpcMethod',
              {
                tracks: trackConfigs,
                attributes,
                exclude,
                assemblies,
                indexType,
                outLocation: self.sessionPath,
                sessionId: 'indexTracksSessionId',
                statusCallback: (message: string) => {
                  this.setIndexingStatus(message)
                },
                timeout: 1000 * 60 * 60 * 1000, // 1000 hours, avoid user ever running into this
              },
            )
            if (indexType === 'perTrack') {
              // should update the single track conf
              trackIds.forEach(trackId => {
                this.addTrackTextSearchConf(
                  trackId,
                  assemblies,
                  attributes,
                  exclude,
                )
                self.session?.notify(
                  `Succesfully indexed track with trackId: ${trackId} `,
                  'success',
                )
              })
            } else {
              assemblies.forEach(assemblyName => {
                const indexedTrackIds = trackConfigs
                  .filter(track =>
                    assemblyName
                      ? track.assemblyNames.includes(assemblyName)
                      : true,
                  )
                  .map(trackConf => trackConf.trackId)
                this.addAggregateTextSearchConf(indexedTrackIds, assemblyName)
                self.session?.notify(
                  `Succesfully indexed assembly: ${assemblyName} `,
                  'success',
                )
              })
            }
          } catch (e) {
            self.session?.notify(
              `An error occurred while indexing: ${e}`,
              'error',
            )
          }
          this.setRunning(false)
          this.setIndexingStatus('0')
          this.dequeueIndexingJob()
        }
        return
      },
      createTextSearchConf(
        name: string,
        trackIds: string[],
        assemblyNames: string[],
      ) {
        const locationPath = self.sessionPath.substring(
          0,
          self.sessionPath.lastIndexOf('/'),
        )
        return {
          type: 'TrixTextSearchAdapter',
          textSearchAdapterId: name,
          ixFilePath: {
            localPath: locationPath + `/trix/${name}.ix`,
            locationType: 'LocalPathLocation',
          },
          ixxFilePath: {
            localPath: locationPath + `/trix/${name}.ixx`,
            locationType: 'LocalPathLocation',
          },
          metaFilePath: {
            localPath: locationPath + `/trix/${name}.json`,
            locationType: 'LocalPathLocation',
          },
          tracks: trackIds,
          assemblyNames,
        }
      },
      addTrackTextSearchConf(
        trackId: string,
        assemblies: string[],
        attributes: string[],
        exclude: string[],
      ) {
        const currentTrackIdx = (self.session?.tracks as Track[]).findIndex(
          t => trackId === t.trackId,
        )
        // name of index
        const id = trackId + '-index'
        const adapterConf = this.createTextSearchConf(id, [trackId], assemblies)
        self.session?.tracks[currentTrackIdx].textSearching.setSubschema(
          'textSearchAdapter',
          adapterConf,
        )
        self.session?.tracks[
          currentTrackIdx
        ].textSearching.indexingAttributes.set(attributes)
        self.session?.tracks[
          currentTrackIdx
        ].textSearching.indexingFeatureTypesToExclude.set(exclude)
      },
      addAggregateTextSearchConf(trackIds: string[], asm: string) {
        // name of index
        const id = asm + '-index'
        const foundIdx = self.jbrowse.aggregateTextSearchAdapters.findIndex(
          x => x.textSearchAdapterId === id,
        )
        const trixConf = this.createTextSearchConf(id, trackIds, [asm])
        if (foundIdx === -1) {
          self.jbrowse.aggregateTextSearchAdapters.push(trixConf)
        } else {
          self.jbrowse.aggregateTextSearchAdapters[foundIdx] = trixConf
        }
      },
      findTrackConfigsToIndex(trackIds: string[], assemblyName?: string) {
        const configs = trackIds
          .map(trackId => {
            const currentTrack = (self.session?.tracks as Track[]).find(
              t => trackId === t.trackId,
            )
            if (!currentTrack) {
              throw new Error(
                `Track not found in session for trackId ${trackId}`,
              )
            }
            return currentTrack
          })
          .filter(track =>
            assemblyName ? track.assemblyNames.includes(assemblyName) : true,
          )
          .filter(track => supportedIndexingAdapters(track.adapter.type))
          .map(conf => {
            return JSON.parse(JSON.stringify(getSnapshot(conf)))
          })
        return configs
      },
      findAppropriateInternetAccount(location: UriLocation) {
        // find the existing account selected from menu
        const selectedId = location.internetAccountId
        if (selectedId) {
          const selectedAccount = self.internetAccounts.find(account => {
            return account.internetAccountId === selectedId
          })
          if (selectedAccount) {
            return selectedAccount
          }
        }

        // if no existing account or not found, try to find working account
        for (const account of self.internetAccounts) {
          const handleResult = account.handlesLocation(location)
          if (handleResult) {
            return account
          }
        }

        // if still no existing account, create ephemeral config to use
        return selectedId
          ? this.createEphemeralInternetAccount(selectedId, {}, location.uri)
          : null
      },
      afterCreate() {
        addDisposer(
          self,
          autorun(async () => {
            self.jbrowse.internetAccounts.forEach(account => {
              this.initializeInternetAccount(account.internetAccountId)
            })
          }),
        )
        addDisposer(
          self,
          autorun(
            async () => {
              if (self.indexingQueue.length > 0 && self.running === false) {
                await this.runIndexingJob()
              }
            },
            { delay: 1000 },
          ),
        )
      },
    }))
    .volatile(self => ({
      history: {},
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
                    { model: self, onClose: doneCallback },
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
              onClick: () => {
                ipcRenderer.invoke('quit')
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
            {
              label: 'Jobs list widget',
              onClick: () => {
                if (self.session) {
                  const widget = self.session.addWidget(
                    'JobsListWidget',
                    'jobsListWidget',
                  )
                  self.session.showWidget(widget)
                }
              },
            },
          ],
        },
      ] as Menu[],
      rpcManager: new RpcManager(
        pluginManager,
        self.jbrowse.configuration.rpc,
        {
          WebWorkerRpcDriver: { WorkerClass: RenderWorker },
          MainThreadRpcDriver: {},
        },
      ),
      adminMode: true,
    }))
    .actions(self => ({
      activateSession(sessionSnapshot: SnapshotIn<typeof Session>) {
        self.setSession(sessionSnapshot)
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setHistory(history: any) {
        self.history = history
      },
      setMenus(newMenus: Menu[]) {
        self.menus = newMenus
      },
      async setPluginsUpdated() {
        if (self.session) {
          await self.saveSession(getSaveSession(self as RootModel))
        }
        await self.openNewSessionCallback(self.sessionPath)
      },
      /**
       * Add a top-level menu
       * @param menuName - Name of the menu to insert.
       * @returns The new length of the top-level menus array
       */
      appendMenu(menuName: string) {
        return self.menus.push({ label: menuName, menuItems: [] })
      },
      /**
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

      afterCreate() {
        addDisposer(
          self,
          autorun(
            async () => {
              if (self.session) {
                try {
                  await self.saveSession(getSaveSession(self as RootModel))
                } catch (e) {
                  console.error(e)
                }
              }
            },
            { delay: 1000 },
          ),
        )
      },
    }))
}

export type RootModelType = ReturnType<typeof rootModelFactory>
export type RootModel = Instance<RootModelType>
