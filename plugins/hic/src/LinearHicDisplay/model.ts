import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { types, getEnv } from 'mobx-state-tree'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

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
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        get blockType() {
          return 'dynamicBlocks'
        },
        get rendererTypeName() {
          return 'HicRenderer'
        },

        renderProps() {
          const config = self.rendererType.configSchema.create(
            getConf(self, 'renderer') || {},
            getEnv(self),
          )

          return {
            ...superRenderProps(),
            config,
            rpcDriverName: self.rpcDriverName,
            displayModel: self,
            resolution: self.resolution,
          }
        },
      }
    })
    .actions(self => ({
      setResolution(n: number) {
        self.resolution = n
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        trackMenuItems() {
          return [
            ...superTrackMenuItems(),
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
      }
    })
