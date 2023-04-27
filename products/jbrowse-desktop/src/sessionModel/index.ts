import { readConfObject } from '@jbrowse/core/configuration'
import addSnackbarToModel from '@jbrowse/core/ui/SnackbarModel'
import { types, IAnyStateTreeNode, SnapshotIn } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'

import { Session as CoreSession } from '@jbrowse/product-core'

// icons
import Base from './Base'
import Assemblies from './Assemblies'
import TrackMenu from './TrackMenu'
import { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'

export declare interface ReferringNode {
  node: IAnyStateTreeNode
  key: string
}

/**
 * #stateModel JBrowseDesktopSessionModel
 * inherits SnackbarModel
 */
export default function sessionModelFactory(
  pluginManager: PluginManager,
  assemblyConfigSchemasType = types.frozen(),
) {
  const sessionModel = types
    .compose(
      'JBrowseDesktopSessionModel',
      Base(pluginManager),
      types.compose(
        CoreSession.ReferenceManagement(pluginManager),
        CoreSession.Connections(pluginManager),
        CoreSession.DrawerWidgets(pluginManager),
        CoreSession.DialogQueue(pluginManager),
        CoreSession.Themes(pluginManager),
        CoreSession.Tracks(pluginManager),
        CoreSession.Views(pluginManager),
      ),
      Assemblies(pluginManager, assemblyConfigSchemasType),
      TrackMenu(pluginManager),
    )
    .views(self => ({
      /**
       * #getter
       */
      get textSearchManager(): TextSearchManager {
        self.connections
        return self.root.textSearchManager
      },
      /**
       * #getter
       */
      get savedSessions() {
        return self.jbrowse.savedSessions
      },
      /**
       * #getter
       */
      get savedSessionNames() {
        return self.jbrowse.savedSessionNames
      },
      /**
       * #getter
       */
      get history() {
        return self.root.history
      },
      /**
       * #getter
       */
      get menus() {
        return self.root.menus
      },
      /**
       * #method
       */
      renderProps() {
        return { theme: readConfObject(self.configuration, 'theme') }
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      editTrackConfiguration(configuration: BaseTrackConfig) {
        self.editConfiguration(configuration)
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
      setSession(sessionSnapshot: SnapshotIn<typeof self>) {
        return self.root.setSession(sessionSnapshot)
      },
    }))

  const extendedSessionModel = pluginManager.evaluateExtensionPoint(
    'Core-extendSession',
    sessionModel,
  ) as typeof sessionModel

  return types.snapshotProcessor(addSnackbarToModel(extendedSessionModel), {
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
