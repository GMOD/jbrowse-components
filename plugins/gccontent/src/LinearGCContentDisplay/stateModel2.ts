import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { types } from 'mobx-state-tree'
// locals
import SharedModelF from './shared'

/**
 * #stateModel LinearGCContentDisplay2
 * #category display
 * extends
 * - [SharedGCContentModel](../sharedgccontentmodel)
 */
export default function stateModelF(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types.compose(
    'LinearGCContentDisplay2',
    SharedModelF(pluginManager, configSchema),
    types.model({
      type: types.literal('LinearGCContentDisplay2'),
    }),
  )
}
