import {
  AppFocusMixin,
  SessionAssembliesMixin,
  TemporaryAssembliesMixin,
} from '@jbrowse/app-core'
import { getConf, readConfObject } from '@jbrowse/core/configuration'
import SnackbarModel from '@jbrowse/core/ui/SnackbarModel'
import {
  ConnectionManagementSessionMixin,
  DialogQueueSessionMixin,
  DrawerWidgetSessionMixin,
  MultipleViewsSessionMixin,
  ReferenceManagementSessionMixin,
  ThemeManagerSessionMixin,
  TracksManagerSessionMixin,
} from '@jbrowse/product-core'
import { types, getParent } from 'mobx-state-tree'

// icons

// locals
import { DesktopSessionFactory } from './DesktopSession'
import { DesktopSessionTrackMenuMixin } from './TrackMenu'
import type { DesktopRootModel } from '../rootModel'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import type { BaseTrackConfig } from '@jbrowse/core/pluggableElementTypes'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { Instance } from 'mobx-state-tree'

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
 * - SessionAssembliesMixin
 * - TemporaryAssembliesMixin
 * - DesktopSessionTrackMenuMixin
 * - SnackbarModel
 * - AppFocusMixin
 *
 */
export default function sessionModelFactory({
  pluginManager,
  assemblyConfigSchema,
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) {
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
        DesktopSessionFactory(pluginManager),
      ),
      SessionAssembliesMixin(pluginManager, assemblyConfigSchema),
      TemporaryAssembliesMixin(pluginManager, assemblyConfigSchema),
      DesktopSessionTrackMenuMixin(pluginManager),
      AppFocusMixin(),
      SnackbarModel(),
    )
    .views(self => ({
      /**
       * #getter
       */
      get assemblies(): Instance<BaseAssemblyConfigSchema[]> {
        return [...self.jbrowse.assemblies, ...self.sessionAssemblies]
      },
      /**
       * #getter
       */
      get root() {
        return getParent<DesktopRootModel>(self)
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      renameCurrentSession(sessionName: string) {
        self.root.renameCurrentSession(sessionName)
      },
      /**
       * #action
       */
      editTrackConfiguration(configuration: BaseTrackConfig) {
        self.editConfiguration(configuration)
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get assemblyNames(): string[] {
        return self.assemblies.map(a => readConfObject(a, 'name'))
      },
      /**
       * #getter
       */
      get version() {
        return self.root.version
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
       * #getter
       */
      get assemblyManager() {
        return self.root.assemblyManager
      },
      /**
       * #getter
       */
      get savedSessionNames() {
        return self.root.savedSessionNames
      },

      /**
       * #method
       */
      renderProps() {
        return {
          theme: self.theme,
          highResolutionScaling: getConf(self, 'highResolutionScaling'),
        }
      },
    }))

  const extendedSessionModel = pluginManager.evaluateExtensionPoint(
    'Core-extendSession',
    sessionModel,
  ) as typeof sessionModel

  return types.snapshotProcessor(extendedSessionModel, {
    // @ts-expect-error
    preProcessor(snapshot) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (snapshot) {
        // @ts-expect-error
        const { connectionInstances, ...rest } = snapshot
        // connectionInstances schema changed from object to an array, so any old
        // connectionInstances as object is in snapshot, filter it out
        // https://github.com/GMOD/jbrowse-components/issues/1903
        if (!Array.isArray(connectionInstances)) {
          return rest
        }
      }
      return snapshot
    },
  })
}

export type DesktopSessionModelType = ReturnType<typeof sessionModelFactory>
export type SessionStateModel = Instance<DesktopSessionModelType>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function z(x: Instance<DesktopSessionModelType>): AbstractSessionModel {
  // this function's sole purpose is to get typescript to check
  // that the session model implements all of AbstractSessionModel
  return x
}
