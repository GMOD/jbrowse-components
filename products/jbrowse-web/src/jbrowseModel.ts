import { JBrowseModelF } from '@jbrowse/app-core'
import clone from 'clone'
import { getSnapshot, resolveIdentifier, types } from 'mobx-state-tree'

// locals
import { removeAttr } from './util'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

// poke some things for testing (this stuff will eventually be removed)
// @ts-expect-error
window.getSnapshot = getSnapshot
// @ts-expect-error
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
    JBrowseModelF({ pluginManager, assemblyConfigSchema }),
    {
      postProcessor(snapshot: Record<string, any>) {
        return removeAttr(clone(snapshot), 'baseUri')
      },
    },
  )
}
