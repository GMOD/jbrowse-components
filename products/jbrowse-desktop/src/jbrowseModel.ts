import { JBrowseModelF } from '@jbrowse/app-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'

/**
 * #stateModel JBrowseDesktopConfigModel
 * the rootModel.jbrowse state model for JBrowseDesktop
 */
export default function JBrowseDesktop(
  pluginManager: PluginManager,
  assemblyConfigSchema: BaseAssemblyConfigSchema,
  adminMode = true,
) {
  return JBrowseModelF({ pluginManager, assemblyConfigSchema, adminMode })
}
