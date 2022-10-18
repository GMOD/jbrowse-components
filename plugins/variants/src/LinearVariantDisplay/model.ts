import { getConf, ConfigurationReference } from '@jbrowse/core/configuration'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import {
  getContainingTrack,
  getSession,
  getContainingView,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'

import { Feature } from '@jbrowse/core/util/simpleFeature'
import { linearBasicDisplayModelFactory } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import { LinearVariantDisplayConfigModel } from './configSchema'

/**
 * !stateModel LinearVariantDisplay
 * extends `LinearBasicDisplay`
 * very similar to basic display, but provides custom widget on feature click
 */
export default function (configSchema: LinearVariantDisplayConfigModel) {
  return types
    .compose(
      'LinearVariantDisplay',
      linearBasicDisplayModelFactory(configSchema),
      types.model({
        /**
         * !property
         */
        type: types.literal('LinearVariantDisplay'),
        /**
         * !property
         */
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .actions(self => ({
      /**
       * !action
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
