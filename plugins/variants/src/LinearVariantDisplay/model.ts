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
          const adapterConfig = getConf(track, 'adapter')
          const header = await rpcManager.call(sessionId, 'CoreGetMetadata', {
            adapterConfig,
          })
          const featureWidget = session.addWidget(
            'VariantFeatureWidget',
            'variantFeature',
            {
              featureData: feature.toJSON(),
              view: getContainingView(self),
              descriptions: header,
            },
          )
          session.showWidget(featureWidget)
        }

        session.setSelection(feature)
      },
    }))
}
