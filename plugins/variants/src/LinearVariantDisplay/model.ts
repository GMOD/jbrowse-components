import { getConf, ConfigurationReference } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getSession,
  getContainingView,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import { linearBasicDisplayModelFactory } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Instance } from 'mobx-state-tree'

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
        type: types.literal('LinearVariantDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
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
              featureData: feature.toJSON(),
              view,
              track,
              descriptions,
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
