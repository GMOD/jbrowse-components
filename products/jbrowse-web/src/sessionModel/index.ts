/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy } from 'react'
import clone from 'clone'
import { PluginDefinition } from '@jbrowse/core/PluginLoader'
import { getConf, AnyConfigurationModel } from '@jbrowse/core/configuration'
import { AbstractSessionModel, JBrowsePlugin } from '@jbrowse/core/util/types'
import addSnackbarToModel from '@jbrowse/core/ui/SnackbarModel'
import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { autorun } from 'mobx'
import {
  addDisposer,
  cast,
  getParent,
  getSnapshot,
  types,
  Instance,
  SnapshotIn,
} from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import { Session as CoreSession } from '@jbrowse/product-core'

// icons
import SettingsIcon from '@mui/icons-material/Settings'
import CopyIcon from '@mui/icons-material/FileCopy'
import DeleteIcon from '@mui/icons-material/Delete'
import InfoIcon from '@mui/icons-material/Info'

// locals
import Assemblies from './Assemblies'
import SessionConnections from './SessionConnections'
import { WebRootModel } from '../rootModel/rootModel'

const AboutDialog = lazy(() => import('./AboutDialog'))

/**
 * #stateModel JBrowseWebSessionModel
 * inherits SnackbarModel
 */
export default function sessionModelFactory(
  pluginManager: PluginManager,
  assemblyConfigSchemasType = types.frozen(),
) {
  const sessionModel = types
    .compose(
      'JBrowseWebSessionModel',
      CoreSession.ReferenceManagement(pluginManager),
      CoreSession.DrawerWidgets(pluginManager),
      CoreSession.DialogQueue(pluginManager),
      CoreSession.Themes(pluginManager),
      CoreSession.MultipleViews(pluginManager),
      CoreSession.SessionTracks(pluginManager),
      Assemblies(pluginManager, assemblyConfigSchemasType),
      SessionConnections(pluginManager),
    )
    .props({
      /**
       * #property
       */
      margin: 0,
      /**
       * #property
       */
      sessionPlugins: types.array(types.frozen()),
    })
    .views(self => ({
      /**
       * #getter
       */
      get tracks(): AnyConfigurationModel[] {
        return [...self.sessionTracks, ...self.jbrowse.tracks]
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setName(str: string) {
        self.name = str
      },
    }))
    .volatile((/* self */) => ({
      /**
       * #volatile
       */
      sessionThemeName: localStorageGetItem('themeName') || 'default',
      /**
       * #volatile
       * this is the current "task" that is being performed in the UI.
       * this is usually an object of the form
       * `{ taskName: "configure", target: thing_being_configured }`
       */
      task: undefined,
    }))
    .views(self => ({
      get root() {
        return getParent<WebRootModel>(self)
      },
      /**
       * #getter
       */
      get shareURL() {
        return getConf(self.jbrowse, 'shareURL')
      },
      /**
       * #getter
       */
      get textSearchManager(): TextSearchManager {
        return this.root.textSearchManager
      },
      /**
       * #getter
       */
      get savedSessions() {
        return this.root.savedSessions
      },
      /**
       * #getter
       */
      get previousAutosaveId() {
        return this.root.previousAutosaveId
      },
      /**
       * #getter
       */
      get savedSessionNames() {
        return this.root.savedSessionNames
      },
      /**
       * #getter
       */
      get history() {
        return this.root.history
      },
      /**
       * #getter
       */
      get menus() {
        return this.root.menus
      },
      /**
       * #getter
       */
      get version() {
        return this.root.version
      },

      /**
       * #method
       */
      renderProps() {
        return {
          theme: self.theme,
        }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      addSessionPlugin(plugin: JBrowsePlugin) {
        if (self.sessionPlugins.some(p => p.name === plugin.name)) {
          throw new Error('session plugin cannot be installed twice')
        }
        self.sessionPlugins.push(plugin)
        self.root.setPluginsUpdated(true)
      },

      /**
       * #action
       */
      removeSessionPlugin(pluginDefinition: PluginDefinition) {
        self.sessionPlugins = cast(
          self.sessionPlugins.filter(
            plugin =>
              plugin.url !== pluginDefinition.url ||
              plugin.umdUrl !== pluginDefinition.umdUrl ||
              plugin.cjsUrl !== pluginDefinition.cjsUrl ||
              plugin.esmUrl !== pluginDefinition.esmUrl,
          ),
        )
        const rootModel = getParent<any>(self)
        rootModel.setPluginsUpdated(true)
      },

      /**
       * #action
       */
      addSavedSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return self.root.addSavedSession(sessionSnapshot)
      },

      /**
       * #action
       */
      removeSavedSession(sessionSnapshot: any) {
        return self.root.removeSavedSession(sessionSnapshot)
      },

      /**
       * #action
       */
      renameCurrentSession(sessionName: string) {
        return self.root.renameCurrentSession(sessionName)
      },

      /**
       * #action
       */
      duplicateCurrentSession() {
        return self.root.duplicateCurrentSession()
      },
      /**
       * #action
       */
      activateSession(sessionName: any) {
        return self.root.activateSession(sessionName)
      },

      /**
       * #action
       */
      setDefaultSession() {
        return self.root.setDefaultSession()
      },

      /**
       * #action
       */
      saveSessionToLocalStorage() {
        return self.root.saveSessionToLocalStorage()
      },

      /**
       * #action
       */
      loadAutosaveSession() {
        return self.root.loadAutosaveSession()
      },

      /**
       * #action
       */
      setSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return self.root.setSession(sessionSnapshot)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      editTrackConfiguration(configuration: AnyConfigurationModel) {
        const { adminMode, sessionTracks } = self
        if (!adminMode && !sessionTracks.includes(configuration)) {
          throw new Error("Can't edit the configuration of a non-session track")
        }
        self.editConfiguration(configuration)
      },
    }))
    .views(self => ({
      /**
       * #method
       */
      getTrackActionMenuItems(config: BaseTrackConfig) {
        const { adminMode, sessionTracks } = self
        const canEdit =
          adminMode || sessionTracks.find(t => t.trackId === config.trackId)

        // disable if it is a reference sequence track
        const isRefSeq = config.type === 'ReferenceSequenceTrack'
        return [
          {
            label: 'About track',
            onClick: () => {
              self.queueDialog(handleClose => [
                AboutDialog,
                { config, handleClose },
              ])
            },
            icon: InfoIcon,
          },
          {
            label: 'Settings',
            disabled: !canEdit,
            onClick: () => self.editTrackConfiguration(config),
            icon: SettingsIcon,
          },
          {
            label: 'Delete track',
            disabled: !canEdit || isRefSeq,
            onClick: () => self.deleteTrackConf(config),
            icon: DeleteIcon,
          },
          {
            label: 'Copy track',
            disabled: isRefSeq,
            onClick: () => {
              const snap = clone(getSnapshot(config)) as any
              const now = Date.now()
              snap.trackId += `-${now}`
              snap.displays.forEach((display: { displayId: string }) => {
                display.displayId += `-${now}`
              })
              // the -sessionTrack suffix to trackId is used as metadata for
              // the track selector to store the track in a special category,
              // and default category is also cleared
              if (!self.adminMode) {
                snap.trackId += '-sessionTrack'
                snap.category = undefined
              }
              snap.name += ' (copy)'
              self.addTrackConf(snap)
            },
            icon: CopyIcon,
          },
        ]
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            localStorageSetItem('drawerPosition', self.drawerPosition)
            localStorageSetItem('themeName', self.themeName)
          }),
        )
      },
    }))

  const extendedSessionModel = pluginManager.evaluateExtensionPoint(
    'Core-extendSession',
    sessionModel,
  ) as typeof sessionModel

  return types.snapshotProcessor(addSnackbarToModel(extendedSessionModel), {
    // @ts-expect-error
    preProcessor(snapshot) {
      if (snapshot) {
        // @ts-expect-error
        const { connectionInstances, ...rest } = snapshot || {}
        // connectionInstances schema changed from object to an array, so any
        // old connectionInstances as object is in snapshot, filter it out
        // https://github.com/GMOD/jbrowse-components/issues/1903
        if (!Array.isArray(connectionInstances)) {
          return rest
        }
      }
      return snapshot
    },
  })
}

export type WebSessionModelType = ReturnType<typeof sessionModelFactory>
export type WebSessionModel = Instance<WebSessionModelType>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function z(x: Instance<WebSessionModelType>): AbstractSessionModel {
  // this function's sole purpose is to get typescript to check
  // that the session model implements all of AbstractSessionModel
  return x
}
