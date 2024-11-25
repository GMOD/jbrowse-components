import { BaseWebSession } from '@jbrowse/web-core'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type { AbstractSessionModel } from '@jbrowse/core/util/types'
import type { Instance } from 'mobx-state-tree'

/**
 * #stateModel JBrowseWebSessionModel
 * composed of
 * - [BaseWebSession](../basewebsession)
 */
export default function sessionModelFactory({
  pluginManager,
  assemblyConfigSchema,
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: BaseAssemblyConfigSchema
}) {
  return BaseWebSession({ pluginManager, assemblyConfigSchema })
}

export type WebSessionModelType = ReturnType<typeof sessionModelFactory>
export type WebSessionModel = Instance<WebSessionModelType>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function z(x: Instance<WebSessionModelType>): AbstractSessionModel {
  // this function's sole purpose is to get typescript to check
  // that the session model implements all of AbstractSessionModel
  return x
}
