import { types } from 'mobx-state-tree'

import { ConfigurationReference } from '@gmod/jbrowse-core/configuration'
import {
  getParentRenderProps,
  getContainingView,
} from '@gmod/jbrowse-core/util/tracks'

import {
  BlockBasedTrack,
  blockBasedTrackModel,
} from '@gmod/jbrowse-plugin-linear-genome-view'

export default (pluginManager, configSchema, trackType) =>
  types.compose(
    trackType,
    blockBasedTrackModel,
    types
      .model({
        type: types.literal(trackType),
        configuration: ConfigurationReference(configSchema),
        height: 100,
      })
      .views(self => ({
        get renderProps() {
          return {
            ...getParentRenderProps(self),
            trackModel: self,
            config: self.configuration.rendering,
          }
        },

        /**
         * @param {Region} region
         * @returns falsy if the region is fine to try rendering. Otherwise,
         *  return a string of text saying why the region can't be rendered.
         */
        regionCannotBeRendered(region) {
          const view = getContainingView(self)
          if (view.bpPerPx > 2) {
            return 'Zoom in to see sequence'
          }
          return undefined
        },
      }))
      .volatile(() => ({
        reactComponent: BlockBasedTrack,
        rendererTypeName: 'DivSequenceRenderer',
      })),
  )
