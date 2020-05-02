import { ConfigurationReference } from '@gmod/jbrowse-core/configuration'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import {
  BlockBasedTrack,
  blockBasedTrackModel,
} from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import { AnyConfigurationSchemaType } from '@gmod/jbrowse-core/configuration/configurationSchema'
import { getContainingView } from '@gmod/jbrowse-core/util'

export default (configSchema: AnyConfigurationSchemaType, trackType: string) =>
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
        regionCannotBeRendered(/* region */) {
          const view = getContainingView(self)
          // @ts-ignore
          if (view && view.bpPerPx >= 1) {
            return 'Zoom in to see sequence'
          }
          return undefined
        },
      }))
      .volatile(() => ({
        ReactComponent: BlockBasedTrack,
        rendererTypeName: 'DivSequenceRenderer',
      })),
  )
