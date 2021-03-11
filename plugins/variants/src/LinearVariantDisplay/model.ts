import { ConfigurationReference } from '@jbrowse/core/configuration'
import {
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
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const featureWidget = session.addWidget(
            'VariantFeatureWidget',
            'variantFeature',
            { featureData: feature.toJSON(), view: getContainingView(self) },
          )
          session.showWidget(featureWidget)
        }

        session.setSelection(feature)
      },
    }))
}
