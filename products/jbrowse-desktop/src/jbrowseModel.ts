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
      // desktop-only: the jbrowse-web deployment "export to web" opens a session
      // in. Empty means the public one (DEFAULT_WEB_BASE_URL); a site that runs
      // its own — and whose data may only be reachable from it — points its
      // configs here instead. Absolute http(s) url; anything else is ignored.
      webExportUrl: {
        type: 'string',
        defaultValue: '',
      },
    },
  })
}
