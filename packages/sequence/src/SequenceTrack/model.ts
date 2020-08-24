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
         * @param region -
         * @returns falsy if the region is fine to try rendering. Otherwise,
         *  return a string of text saying why the region can't be rendered.
         */
        regionCannotBeRendered(/* region */) {
          const view = getContainingView(self)
          // @ts-ignore
          if (view && view.bpPerPx >= 1) {
            return 'Zoom in to see sequence'
          }
          // TODOSTATS: above is the example of bpPerPx limit. notes will be here
          // Could have hardcoded limit in basetrack that limits all tracks to be a certain bpPerPx
          // and then tracks themselves can override that limit if need a higher/lower number
          // stats estimation would be in something similar to stats until, calculate a certain
          // stat like feature limit and then if it exceeds a certain amount also return the
          // 'zoom in to see sequence' message when limit is hit. possibly allow users
          // to adjust the limit or remove it if they really want to but should give a warning/suggestion
          // that removing the limit may cause the track to fail rendering due to massive data load
          return undefined
        },
      }))
      .volatile(() => ({
        ReactComponent: BlockBasedTrack,
        rendererTypeName: 'DivSequenceRenderer',
      })),
  )
