import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { JBrowseModelF } from '@jbrowse/app-core'

/**
 * #stateModel JBrowseReactAppConfigModel
 * #category root
 * the rootModel.jbrowse state model for JBrowse Web
 */
export default function JBrowseWeb({
  pluginManager,
  assemblyConfigSchema,
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: AnyConfigurationSchemaType
}) {
  return JBrowseModelF({ pluginManager, assemblyConfigSchema })
}
