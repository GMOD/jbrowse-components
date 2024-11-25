import { types } from 'mobx-state-tree'
import SharedModelF from './shared'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
// locals

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
