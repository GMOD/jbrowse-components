import { AppSessionModel } from '@jbrowse/app-core'
import { types } from '@jbrowse/mobx-state-tree'
import {
  ConnectionManagementSessionMixin,
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
 * Holds a JBrowse Desktop session: its views, session tracks, assemblies,
 * connections, theme and preferences, and the workspace layout.
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
    AppSessionModel({ pluginManager, assemblyConfigSchema }),
    ConnectionManagementSessionMixin(pluginManager),
    DesktopSessionTrackMenuMixin(pluginManager),
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
