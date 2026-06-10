import {
  AppSessionMixin,
  AssembliesMixin,
  DockviewLayoutMixin,
} from '@jbrowse/app-core'
import { types } from '@jbrowse/mobx-state-tree'
import {
  ConnectionManagementSessionMixin,
  MultipleViewsSessionMixin,
  ReferenceManagementSessionMixin,
  ThemeManagerSessionMixin,
  TracksManagerSessionMixin,
} from '@jbrowse/product-core'

import { DesktopSessionTrackMenuMixin } from './TrackMenu.ts'

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
 * - AppSessionMixin
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
  const sessionModel = types.compose(
    'JBrowseDesktopSessionModel',
    ReferenceManagementSessionMixin(pluginManager),
    ConnectionManagementSessionMixin(pluginManager),
    ThemeManagerSessionMixin(pluginManager),
    TracksManagerSessionMixin(pluginManager),
    MultipleViewsSessionMixin(pluginManager),
    AssembliesMixin(pluginManager, assemblyConfigSchema),
    AppSessionMixin(pluginManager),
    DesktopSessionTrackMenuMixin(pluginManager),
    DockviewLayoutMixin(),
  )

  const extendedSessionModel = pluginManager.evaluateExtensionPoint(
    'Core-extendSession',
    sessionModel,
  ) as typeof sessionModel

  return extendedSessionModel.preProcessSnapshot<
    Record<string, unknown> | undefined
  >(snapshot => {
    // connectionInstances schema changed from object to an array, so any old
    // connectionInstances as object in snapshot should be filtered out
    // https://github.com/GMOD/jbrowse-components/issues/1903
    if (snapshot && !Array.isArray(snapshot.connectionInstances)) {
      const { connectionInstances: _, ...rest } = snapshot
      return rest
    }
    return snapshot
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
