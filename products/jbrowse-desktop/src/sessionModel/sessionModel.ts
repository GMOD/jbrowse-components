import {
  AppSessionMixin,
  AssembliesMixin,
  DockviewLayoutMixin,
} from '@jbrowse/app-core'
import { types } from '@jbrowse/mobx-state-tree'
import {
  ConnectionManagementSessionMixin,
  MultipleViewsSessionMixin,
  PreferencesSessionMixin,
  ReferenceManagementSessionMixin,
  ThemeManagerSessionMixin,
  TracksManagerSessionMixin,
  finalizeSession,
} from '@jbrowse/product-core'

import { DesktopSessionTrackMenuMixin } from './TrackMenu.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager/assemblyConfigSchema'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { AssertSessionModel } from '@jbrowse/product-core'

/**
 * #stateModel JBrowseDesktopSessionModel
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
    // nested to stay within types.compose's 10-argument limit
    types.compose(
      MultipleViewsSessionMixin(pluginManager),
      PreferencesSessionMixin(pluginManager),
    ),
    AssembliesMixin(pluginManager, assemblyConfigSchema),
    AppSessionMixin(pluginManager),
    DesktopSessionTrackMenuMixin(pluginManager),
    DockviewLayoutMixin(),
  )

  return finalizeSession(pluginManager, sessionModel)
}

export type DesktopSessionModelType = ReturnType<typeof sessionModelFactory>
export type SessionStateModel = Instance<DesktopSessionModelType>

// compile-time check that the session model implements AbstractSessionModel
export type _AssertSessionModel = AssertSessionModel<SessionStateModel>
