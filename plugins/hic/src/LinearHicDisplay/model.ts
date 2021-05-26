import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { types, getEnv } from 'mobx-state-tree'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'

export default (configSchema: AnyConfigurationSchemaType) =>
  types
    .compose(
      'LinearHicDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('LinearHicDisplay'),
        configuration: ConfigurationReference(configSchema),
        resolution: types.optional(types.number, 1),
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
          getEnv(self),
        )

        return {
          ...self.composedRenderProps,
          ...getParentRenderProps(self),
          config,
          rpcDriverName: self.rpcDriverName,
          displayModel: self,
          resolution: self.resolution,
        }
      },
    }))
    .actions(self => ({
      setResolution(n: number) {
        self.resolution = n
      },
    }))
    .views(self => {
      const { trackMenuItems } = self
      return {
        get composedTrackMenuItems() {
          return [
            {
              label: 'Resolution',
              subMenu: [
                {
                  label: 'Finer resolution',
                  onClick: () => {
                    self.setResolution(self.resolution * 2)
                  },
                },
                {
                  label: 'Coarser resolution',
                  onClick: () => {
                    self.setResolution(self.resolution / 2)
                  },
                },
              ],
            },
          ]
        },

        get trackMenuItems() {
          return [...trackMenuItems, ...this.composedTrackMenuItems]
        },
      }
    })
