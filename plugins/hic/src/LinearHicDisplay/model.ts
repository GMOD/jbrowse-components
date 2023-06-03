import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { types, getEnv } from 'mobx-state-tree'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

/**
 * #stateModel LinearHicDisplay
 * #category display
 * extends `BaseLinearDisplay`
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

export default (configSchema: AnyConfigurationSchemaType) =>
  types
    .compose(
      'LinearHicDisplay',
      BaseLinearDisplay,
      types.model({
        /**
         * #property
         */
        type: types.literal('LinearHicDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        resolution: types.optional(types.number, 1),
      }),
    )
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #getter
         */
        get blockType() {
          return 'dynamicBlocks'
        },
        /**
         * #getter
         */
        get rendererTypeName() {
          return 'HicRenderer'
        },
        /**
         * #method
         */
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
      /**
       * #action
       */
      setResolution(n: number) {
        self.resolution = n
      },
    }))
    .views(self => {
      const { trackMenuItems: superTrackMenuItems } = self
      return {
        /**
         * #getter
         */
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
