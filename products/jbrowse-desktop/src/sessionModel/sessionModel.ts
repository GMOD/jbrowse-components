import { AssembliesMixin, DockviewLayoutMixin } from '@jbrowse/app-core'
import { getConf, readConfObject } from '@jbrowse/core/configuration'
import { getParent, types } from '@jbrowse/mobx-state-tree'
import {
  ConnectionManagementSessionMixin,
  MultipleViewsSessionMixin,
  ReferenceManagementSessionMixin,
  ThemeManagerSessionMixin,
  TracksManagerSessionMixin,
} from '@jbrowse/product-core'

import { DesktopSessionTrackMenuMixin } from './TrackMenu.ts'

import type { DesktopRootModel } from '../rootModel/rootModel.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

/**
 * #stateModel JBrowseDesktopSessionModel
 * composed of
 * - ReferenceManagementSessionMixin
 * - ConnectionManagementSessionMixin
 * - ThemeManagerSessionMixin
 * - TracksManagerSessionMixin
 * - MultipleViewsSessionMixin
 * - AssembliesMixin
 * - DesktopSessionTrackMenuMixin
 * - DockviewLayoutMixin
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
      ReferenceManagementSessionMixin(pluginManager),
      ConnectionManagementSessionMixin(pluginManager),
      ThemeManagerSessionMixin(pluginManager),
      TracksManagerSessionMixin(pluginManager),
      MultipleViewsSessionMixin(pluginManager),
      AssembliesMixin(pluginManager, assemblyConfigSchema),
      DesktopSessionTrackMenuMixin(pluginManager),
      DockviewLayoutMixin(),
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
    preProcessor(snapshot: Record<string, unknown> | undefined) {
      // connectionInstances schema changed from object to an array, so any old
      // connectionInstances as object in snapshot should be filtered out
      // https://github.com/GMOD/jbrowse-components/issues/1903
      if (snapshot && !Array.isArray(snapshot.connectionInstances)) {
        const { connectionInstances: _, ...rest } = snapshot
        return rest
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
