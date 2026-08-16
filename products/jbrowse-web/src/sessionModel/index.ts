import { types } from '@jbrowse/mobx-state-tree'
import {
  BaseWebSessionModel,
  WebSessionManagementMixin,
  finalizeWebSession,
} from '@jbrowse/web-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type {
  SessionWithConfigEditing,
  SessionWithConnectionEditing,
  SessionWithFocusedViewAndDrawerWidgets,
  SessionWithSessionPlugins,
} from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { AssertExtends, AssertSessionModel } from '@jbrowse/product-core'

/**
 * #stateModel JBrowseWebSessionModel
 *
 * The full-app web session: the shared web session plus the saved-session
 * database management surface (favorites, recent sessions, activate/delete).
 */
export default function sessionModelFactory({
  pluginManager,
  assemblyConfigSchema,
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) {
  return finalizeWebSession(
    pluginManager,
    types.compose(
      BaseWebSessionModel({ pluginManager, assemblyConfigSchema }),
      WebSessionManagementMixin(pluginManager),
    ),
  )
}

export type WebSessionModelType = ReturnType<typeof sessionModelFactory>
export type WebSessionModel = Instance<WebSessionModelType>

// the capability contracts the web app relies on — see AssertSessionModel for
// why each one is asserted separately
export type _AssertSessionModel = AssertSessionModel<WebSessionModel>
export type _AssertFocusedView = AssertExtends<
  WebSessionModel,
  SessionWithFocusedViewAndDrawerWidgets
>
export type _AssertConnectionEditing = AssertExtends<
  WebSessionModel,
  SessionWithConnectionEditing
>
export type _AssertConfigEditing = AssertExtends<
  WebSessionModel,
  SessionWithConfigEditing
>
export type _AssertSessionPlugins = AssertExtends<
  WebSessionModel,
  SessionWithSessionPlugins
>
