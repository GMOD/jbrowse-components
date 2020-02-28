import {
  ConfigurationReference,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { getSession } from '@gmod/jbrowse-core/util'
import {
  blockBasedTrackModel,
  BlockBasedTrack,
} from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import TrackControls from './TrackControls'

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
        console.log('Opening filter config')
        const session = getSession(self)
        const editor = session.addDrawerWidget(
          'GDCFilterConfigurationEditorDrawerWidget',
          'configEditor',
          { target: self.configuration },
        )
        session.showDrawerWidget(editor)
      },
    }))

    .views(self => ({
      get ControlsComponent() {
        return TrackControls
      },

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
    }))
    .volatile(() => ({
      ReactComponent: BlockBasedTrack,
    }))
}
