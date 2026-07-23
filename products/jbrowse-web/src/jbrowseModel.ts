import { JBrowseModelF } from '@jbrowse/app-core'
import { stripBaseUris } from '@jbrowse/core/util/addRelativeUris'
import { getSnapshot, resolveIdentifier, types } from '@jbrowse/mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

// poke some things for testing (this stuff will eventually be removed)
window.getSnapshot = getSnapshot
window.resolveIdentifier = resolveIdentifier

/**
 * #stateModel JBrowseWebConfigModel
 * #internal thin product wrapper that declares no members of its own — the
 * documented surface is AppCoreJBrowseModel, so this gets no website page
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
  return types.snapshotProcessor(
    JBrowseModelF({
      pluginManager,
      assemblyConfigSchema,
    }),
    {
      // strip the synthetic baseUri keys added by addRelativeUris when
      // serializing config back out (e.g. for the admin "Save config" flow)
      postProcessor(snapshot) {
        return stripBaseUris(structuredClone(snapshot))
      },
    },
  )
}
