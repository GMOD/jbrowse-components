import { types } from 'mobx-state-tree'
import SharedModelF from './shared'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
// locals

/**
 * #stateModel LinearGCContentDisplay
 * #category display
 * base model `SharedGCContentModel`
 */
export default function stateModelF(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types.compose(
    'LinearGCContentDisplay',
    SharedModelF(pluginManager, configSchema),
    types.model({
      type: types.literal('LinearGCContentDisplay'),
    }),
  )
}
