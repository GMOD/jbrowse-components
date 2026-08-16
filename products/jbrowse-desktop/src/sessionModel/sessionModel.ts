import {
  AppSessionMixin,
  AssembliesMixin,
  WorkspaceLayoutMixin,
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
import type {
  SessionWithConfigEditing,
  SessionWithConnections,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { AssertExtends, AssertSessionModel } from '@jbrowse/product-core'

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
    WorkspaceLayoutMixin(),
  )

  return finalizeSession(pluginManager, sessionModel)
}

export type DesktopSessionModelType = ReturnType<typeof sessionModelFactory>
export type SessionStateModel = Instance<DesktopSessionModelType>

// the capability contracts the desktop app relies on — see AssertSessionModel
// for why each one is asserted separately
export type _AssertSessionModel = AssertSessionModel<SessionStateModel>
export type _AssertFocusedView = AssertExtends<
  SessionStateModel,
  SessionWithFocusedViewAndDrawerWidgets
>
export type _AssertConnections = AssertExtends<
  SessionStateModel,
  SessionWithConnections
>
export type _AssertConfigEditing = AssertExtends<
  SessionStateModel,
  SessionWithConfigEditing
>
