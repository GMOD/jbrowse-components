import { JBrowseModelF } from '@jbrowse/app-core'
import { getSnapshot, resolveIdentifier, types } from '@jbrowse/mobx-state-tree'
import { removeAttr } from '@jbrowse/product-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

// poke some things for testing (this stuff will eventually be removed)
window.getSnapshot = getSnapshot
window.resolveIdentifier = resolveIdentifier

/**
 * #stateModel JBrowseWebConfigModel
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
        return removeAttr(structuredClone(snapshot), 'baseUri')
      },
    },
  )
}
