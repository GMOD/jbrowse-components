import { JBrowseModelF } from '@jbrowse/app-core'
import { getSnapshot, resolveIdentifier } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'

// poke some things for testing (this stuff will eventually be removed)
window.getSnapshot = getSnapshot
window.resolveIdentifier = resolveIdentifier

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
