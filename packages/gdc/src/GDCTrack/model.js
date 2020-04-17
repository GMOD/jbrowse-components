import { ConfigurationReference } from '@gmod/jbrowse-core/configuration'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { getSession } from '@gmod/jbrowse-core/util'
import {
  blockBasedTrackModel,
  BlockBasedTrack,
} from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'

export default function stateModelFactory(configSchema) {
  return types
    .compose(
      'GDCTrack',
      blockBasedTrackModel,
      types.model({
        type: types.literal('GDCTrack'),
        configuration: ConfigurationReference(configSchema),
        height: 100,
      }),
    )

    .actions(self => ({
      openFilterConfig() {
        const session = getSession(self)
        const editor = session.addDrawerWidget(
          'GDCFilterDrawerWidget',
          'gdcFilter',
          { target: self.configuration },
        )
        session.showDrawerWidget(editor)
      },

      selectFeature(feature) {
        const session = getSession(self)
        const featureWidget = session.addDrawerWidget(
          'GDCFeatureDrawerWidget',
          'gdcFeature',
          { featureData: feature.toJSON() },
        )
        session.showDrawerWidget(featureWidget)
        session.setSelection(feature)
      },
    }))

    .views(self => ({
      get renderProps() {
        return {
          ...self.composedRenderProps,
          ...getParentRenderProps(self),
          config: self.configuration.renderer,
        }
      },

      get rendererTypeName() {
        return self.configuration.renderer.type
      },

      get menuOptions() {
        return [
          {
            label: 'Filter',
            onClick: self.openFilterConfig,
            icon: 'filter_list',
          },
        ]
      },
    }))
    .volatile(() => ({
      ReactComponent: BlockBasedTrack,
    }))
}
