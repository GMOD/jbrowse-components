/* eslint-disable @typescript-eslint/no-explicit-any */
import { lazy } from 'react'
import clone from 'clone'
import { PluginDefinition } from '@jbrowse/core/PluginLoader'
import {
  getConf,
  AnyConfigurationModel,
  AnyConfiguration,
} from '@jbrowse/core/configuration'
import { AbstractSessionModel, JBrowsePlugin } from '@jbrowse/core/util/types'
import addSnackbarToModel from '@jbrowse/core/ui/SnackbarModel'
import { localStorageGetItem, localStorageSetItem } from '@jbrowse/core/util'
import { autorun } from 'mobx'
import {
  addDisposer,
  cast,
  getParent,
  getRoot,
  getSnapshot,
  types,
  Instance,
  SnapshotIn,
} from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'

import { Session as CoreSession } from '@jbrowse/product-core'

// icons
import SettingsIcon from '@mui/icons-material/Settings'
import CopyIcon from '@mui/icons-material/FileCopy'
import DeleteIcon from '@mui/icons-material/Delete'
import InfoIcon from '@mui/icons-material/Info'

import { BaseSession } from './Base'
import Assemblies from './Assemblies'
import SessionConnections from './SessionConnections'
import { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

const AboutDialog = lazy(() => import('@jbrowse/core/ui/AboutDialog'))

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
      CoreSession.Views(pluginManager),
      CoreSession.Tracks(pluginManager),
      BaseSession(pluginManager),
      Assemblies(pluginManager, assemblyConfigSchemasType),
      SessionConnections(pluginManager),
    )
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
        return getParent<any>(self).textSearchManager
      },
      /**
       * #getter
       */
      get savedSessions() {
        return getParent<any>(self).savedSessions
      },
      /**
       * #getter
       */
      get previousAutosaveId() {
        return getParent<any>(self).previousAutosaveId
      },
      /**
       * #getter
       */
      get savedSessionNames() {
        return getParent<any>(self).savedSessionNames
      },
      /**
       * #getter
       */
      get history() {
        return getParent<any>(self).history
      },
      /**
       * #getter
       */
      get menus() {
        return getParent<any>(self).menus
      },
      /**
       * #getter
       */
      get version() {
        return getParent<any>(self).version
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
    .actions(self => {
      const super_addTrackConf = self.addTrackConf
      const super_deletetrackConf = self.deleteTrackConf
      return {
        /**
         * #action
         */
        addSessionPlugin(plugin: JBrowsePlugin) {
          if (self.sessionPlugins.some(p => p.name === plugin.name)) {
            throw new Error('session plugin cannot be installed twice')
          }
          self.sessionPlugins.push(plugin)
          getRoot<any>(self).setPluginsUpdated(true)
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
        addTrackConf(trackConf: AnyConfiguration) {
          if (self.adminMode) {
            return super_addTrackConf(trackConf)
          }
          const { trackId, type } = trackConf as {
            type: string
            trackId: string
          }
          if (!type) {
            throw new Error(`unknown track type ${type}`)
          }
          const track = self.sessionTracks.find(
            (t: any) => t.trackId === trackId,
          )
          if (track) {
            return track
          }
          const length = self.sessionTracks.push(trackConf)
          return self.sessionTracks[length - 1]
        },

        /**
         * #action
         */
        deleteTrackConf(trackConf: AnyConfigurationModel) {
          // try to delete it in the main config if in admin mode
          const found = super_deletetrackConf(trackConf)
          if (found) {
            return found
          }
          // if not found or not in admin mode, try to delete it in the sessionTracks
          const { trackId } = trackConf
          const idx = self.sessionTracks.findIndex(t => t.trackId === trackId)
          if (idx === -1) {
            return undefined
          }
          return self.sessionTracks.splice(idx, 1)
        },

        /**
         * #action
         */
        addSavedSession(sessionSnapshot: SnapshotIn<typeof self>) {
          return getParent<any>(self).addSavedSession(sessionSnapshot)
        },

        /**
         * #action
         */
        removeSavedSession(sessionSnapshot: any) {
          return getParent<any>(self).removeSavedSession(sessionSnapshot)
        },

        /**
         * #action
         */
        renameCurrentSession(sessionName: string) {
          return getParent<any>(self).renameCurrentSession(sessionName)
        },

        /**
         * #action
         */
        duplicateCurrentSession() {
          return getParent<any>(self).duplicateCurrentSession()
        },
        /**
         * #action
         */
        activateSession(sessionName: any) {
          return getParent<any>(self).activateSession(sessionName)
        },

        /**
         * #action
         */
        setDefaultSession() {
          return getParent<any>(self).setDefaultSession()
        },

        /**
         * #action
         */
        saveSessionToLocalStorage() {
          return getParent<any>(self).saveSessionToLocalStorage()
        },

        /**
         * #action
         */
        loadAutosaveSession() {
          return getParent<any>(self).loadAutosaveSession()
        },

        /**
         * #action
         */
        setSession(sessionSnapshot: SnapshotIn<typeof self>) {
          return getParent<any>(self).setSession(sessionSnapshot)
        },
      }
    })
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

export type SessionStateModel = ReturnType<typeof sessionModelFactory>
export type SessionModel = Instance<SessionStateModel>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function z(x: Instance<SessionStateModel>): AbstractSessionModel {
  // this function's sole purpose is to get typescript to check
  // that the session model implements all of AbstractSessionModel
  return x
}
