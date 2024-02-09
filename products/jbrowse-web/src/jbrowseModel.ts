import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { JBrowseModelF } from '@jbrowse/app-core'
import { getSnapshot, resolveIdentifier, types } from 'mobx-state-tree'
import clone from 'clone'

// locals
import { removeAttr } from './util'

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
  adminMode
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: AnyConfigurationSchemaType
  adminMode: boolean
}) {
  return types.snapshotProcessor(
    JBrowseModelF({ pluginManager, assemblyConfigSchema, adminMode }),
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      postProcessor(snapshot: Record<string, any>) {
        return removeAttr(clone(snapshot), 'baseUri')
      },
    },
  )
}
