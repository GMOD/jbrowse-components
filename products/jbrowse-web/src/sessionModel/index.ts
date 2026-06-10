import { types } from '@jbrowse/mobx-state-tree'
import {
  BaseWebSessionModel,
  WebSessionManagementMixin,
  finalizeWebSession,
} from '@jbrowse/web-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type { AbstractSessionModel } from '@jbrowse/core/util/types'
import type { Instance } from '@jbrowse/mobx-state-tree'

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function z(x: Instance<WebSessionModelType>): AbstractSessionModel {
  // this function's sole purpose is to get typescript to check
  // that the session model implements all of AbstractSessionModel
  return x
}
