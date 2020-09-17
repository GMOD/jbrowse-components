import {
  ConfigurationReference,
  getConf,
} from '@gmod/jbrowse-core/configuration'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { blockBasedTrackModel } from '@gmod/jbrowse-plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import { AnyConfigurationSchemaType } from '@gmod/jbrowse-core/configuration/configurationSchema'

export default (configSchema: AnyConfigurationSchemaType) =>
  types
    .compose(
      'HicTrack',
      blockBasedTrackModel,
      types.model({
        type: types.literal('HicTrack'),
        configuration: ConfigurationReference(configSchema),
        height: types.optional(types.integer, 100),
      }),
    )
    .views(self => ({
      get blockType() {
        return 'dynamicBlocks'
      },
      get rendererTypeName() {
        return 'HicRenderer'
      },

      /**
       * the react props that are passed to the Renderer when data
       * is rendered in this track
       */
      get renderProps() {
        const config = self.rendererType.configSchema.create(
          getConf(self, 'renderer') || {},
        )

        return {
          ...self.composedRenderProps,
          ...getParentRenderProps(self),
          config,
          trackModel: self,
        }
      },
    }))
