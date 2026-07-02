import { BaseWebSession } from '@jbrowse/web-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { AssertSessionModel } from '@jbrowse/product-core'

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

// compile-time check that the session model implements AbstractSessionModel
export type _AssertSessionModel = AssertSessionModel<WebSessionModel>
