import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { types } from 'mobx-state-tree'
// locals
import SharedModelF from './shared'

/**
 * #stateModel LinearGCContentTrackDisplay
 * #category display
 *
 * used on GCContentTrack, separately from the display type on the
 * ReferenceSequenceTrack
 *
 * extends
 * - [SharedGCContentModel](../sharedgccontentmodel)
 */
export default function stateModelF(
  pluginManager: PluginManager,
  configSchema: AnyConfigurationSchemaType,
) {
  return types.compose(
    'LinearGCContentTrackDisplay',
    SharedModelF(pluginManager, configSchema),
    types.model({
      type: types.literal('LinearGCContentTrackDisplay'),
    }),
  )
}
