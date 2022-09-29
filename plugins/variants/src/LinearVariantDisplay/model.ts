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

export default function (configSchema: LinearVariantDisplayConfigModel) {
  return types
    .compose(
      'LinearVariantDisplay',
      linearBasicDisplayModelFactory(configSchema),
      types.model({
        type: types.literal('LinearVariantDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .actions(self => ({
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
