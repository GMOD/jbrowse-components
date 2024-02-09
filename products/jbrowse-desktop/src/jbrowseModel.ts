import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot, resolveIdentifier } from 'mobx-state-tree'
import { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import { JBrowseModelF } from '@jbrowse/app-core'

// poke some things for testing (this stuff will eventually be removed)
// @ts-expect-error
window.getSnapshot = getSnapshot

// @ts-expect-error
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
