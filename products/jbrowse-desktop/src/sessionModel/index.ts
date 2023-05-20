import { readConfObject } from '@jbrowse/core/configuration'
import addSnackbarToModel from '@jbrowse/core/ui/SnackbarModel'
import { types, Instance, getParent } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'

// icons
import { DesktopSessionAssembliesModel } from './Assemblies'
import { DesktopSessionTrackMenuMixin } from './TrackMenu'
import { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import { DesktopRootModel } from '../rootModel'
import {
  ConnectionManagementSessionMixin,
  DialogQueueSessionMixin,
  DrawerWidgetSessionMixin,
  MultipleViewsSessionMixin,
  ReferenceManagementSessionMixin,
  ThemeManagerSessionMixin,
  TracksManagerSessionMixin,
} from '@jbrowse/product-core'
import { DesktopSessionFactory } from './DesktopSession'

/**
 * #stateModel JBrowseDesktopSessionModel
 * composed of
 * - ReferenceManagementSessionMixin
 * - ConnectionManagementSessionMixin
 * - DrawerWidgetSessionMixin
 * - DialogQueueSessionMixin
 * - ThemeManagerSessionMixin
 * - TracksManagerSessionMixin
 * - MultipleViewsSessionMixin
 * - DesktopSessionMixin
 * - DesktopSessionAssembliesModel
 * - DesktopSessionTrackMenuMixin
 * - SnackbarModel
 */
export default function sessionModelFactory(
  pluginManager: PluginManager,
  assemblyConfigSchemasType = types.frozen(),
) {
  const sessionModel = types
    .compose(
      'JBrowseDesktopSessionModel',
      types.compose(
        ReferenceManagementSessionMixin(pluginManager),
        ConnectionManagementSessionMixin(pluginManager),
        DrawerWidgetSessionMixin(pluginManager),
        DialogQueueSessionMixin(pluginManager),
        ThemeManagerSessionMixin(pluginManager),
        TracksManagerSessionMixin(pluginManager),
        MultipleViewsSessionMixin(pluginManager),
      ),
      DesktopSessionFactory(pluginManager),
      DesktopSessionAssembliesModel(pluginManager, assemblyConfigSchemasType),
      DesktopSessionTrackMenuMixin(pluginManager),
    )
    .views(self => ({
      /**
       * #getter
       */
      get root() {
        return getParent<DesktopRootModel>(self)
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
      get savedSessionNames() {
        return this.root.savedSessionNames
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
      renameCurrentSession(sessionName: string) {
        return self.root.renameCurrentSession(sessionName)
      },
      /**
       * #action
       */
      editTrackConfiguration(configuration: BaseTrackConfig) {
        self.editConfiguration(configuration)
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

export type SessionStateModelType = ReturnType<typeof sessionModelFactory>
export type SessionStateModel = Instance<SessionStateModelType>
