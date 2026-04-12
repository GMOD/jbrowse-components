import { JBrowseModelF } from '@jbrowse/app-core'
import { getSnapshot, resolveIdentifier, types } from '@jbrowse/mobx-state-tree'

import { migrateConfigSnapshot } from './migrateSessionSnapshot.ts'
import { removeAttr } from './util.ts'

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
  adminMode,
}: {
  pluginManager: PluginManager
  assemblyConfigSchema: AnyConfigurationSchemaType
  adminMode: boolean
}) {
  return types.snapshotProcessor(
    JBrowseModelF({
      pluginManager,
      assemblyConfigSchema,
      adminMode,
    }),
    {
      preProcessor(snapshot: Record<string, unknown>) {
        return migrateConfigSnapshot(snapshot)
      },
      postProcessor(snapshot) {
        return removeAttr(
          structuredClone(snapshot) as unknown as Record<string, unknown>,
          'baseUri',
        )
      },
    },
  )
}
