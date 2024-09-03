import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { types } from 'mobx-state-tree'
// locals
import SharedModelF from './shared'

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
