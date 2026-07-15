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
) {
  return JBrowseModelF({
    pluginManager,
    assemblyConfigSchema,
    // desktop-only: records the hosted config a session was launched from (a
    // "show available genomes" hub entry) so "export to web" can reuse it as
    // the session base
    extraConfigSlots: {
      sourceConfigUrl: {
        type: 'string',
        defaultValue: '',
      },
    },
  })
}
