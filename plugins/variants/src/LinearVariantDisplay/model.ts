import { getConf, ConfigurationReference } from '@jbrowse/core/configuration'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import {
  getContainingTrack,
  getSession,
  getContainingView,
  isSessionModelWithWidgets,
  Feature,
} from '@jbrowse/core/util'

import { linearBasicDisplayModelFactory } from '@jbrowse/plugin-linear-genome-view'
import { Instance, types } from 'mobx-state-tree'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

/**
 * #stateModel LinearVariantDisplay
 * similar to basic display, but provides custom widget on feature click
 * extends
 *
 * - [LinearBasicDisplay](../linearbasicdisplay)
 */
export default function stateModelFactory(
  configSchema: AnyConfigurationSchemaType,
) {
  return types
    .compose(
      'LinearVariantDisplay',
      linearBasicDisplayModelFactory(configSchema),
      types.model({
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),

        /**
         * #property
         */
        type: types.literal('LinearVariantDisplay'),
      }),
    )

    .actions(self => ({
      /**
       * #action
       */
      async selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const { rpcManager } = session
          const sessionId = getRpcSessionId(self)
          const track = getContainingTrack(self)
          const view = getContainingView(self)
          const adapterConfig = getConf(track, 'adapter')
          const descriptions = await rpcManager.call(
            sessionId,
            'CoreGetMetadata',
            {
              adapterConfig,
            },
          )
          session.showWidget(
            session.addWidget('VariantFeatureWidget', 'variantFeature', {
              descriptions,
              featureData: feature.toJSON(),
              track,
              view,
            }),
          )
        }

        session.setSelection(feature)
      },
    }))
}

export type LinearVariantDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearVariantDisplayModel = Instance<LinearVariantDisplayStateModel>
