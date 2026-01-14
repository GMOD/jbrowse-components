import { JBrowseModelF } from '@jbrowse/app-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

/**
 * #stateModel JBrowseReactAppConfigModel
 * #category root
 * the rootModel.jbrowse state model for JBrowse Web
 */
export default function JBrowseWeb({
  pluginManager,
  assemblyConfigSchema,
  adminMode = false,
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: AnyConfigurationSchemaType
  adminMode?: boolean
}) {
  return JBrowseModelF({ pluginManager, assemblyConfigSchema, adminMode })
}
