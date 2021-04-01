import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'

export default (configSchema: AnyConfigurationSchemaType) =>
  types
    .compose(
      'LinearHicDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('LinearHicDisplay'),
        configuration: ConfigurationReference(configSchema),
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
          rpcDriverName: self.rpcDriverName,
          displayModel: self,
        }
      },
    }))
