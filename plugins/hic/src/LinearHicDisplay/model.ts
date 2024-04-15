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
        /**
         * #property
         */
        useLogScale: false,
        /**
         * #property
         */
        colorScheme: types.maybe(types.string),
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
            {
              ...getConf(self, 'renderer'),

              // add specific jexl color callback when using pre-defined color schemes
              ...(self.colorScheme
                ? { color: 'jexl:interpolate(count,scale)' }
                : {}),
            },
            getEnv(self),
          )

          return {
            ...superRenderProps(),
            config,
            rpcDriverName: self.rpcDriverName,
            displayModel: self,
            resolution: self.resolution,
            useLogScale: self.useLogScale,
            colorScheme: self.colorScheme,
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
      /**
       * #action
       */
      setUseLogScale(f: boolean) {
        self.useLogScale = f
      },
      /**
       * #action
       */
      setColorScheme(f?: string) {
        self.colorScheme = f
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
              label: 'Use log scale',
              type: 'checkbox',
              checked: self.useLogScale,
              onClick: () => self.setUseLogScale(!self.useLogScale),
            },
            {
              label: 'Color scheme',
              type: 'subMenu',
              subMenu: [
                {
                  label: 'Fall',
                  onClick: () => self.setColorScheme('fall'),
                },
                {
                  label: 'Viridis',
                  onClick: () => self.setColorScheme('viridis'),
                },
                {
                  label: 'Juicebox',
                  onClick: () => self.setColorScheme('juicebox'),
                },
                {
                  label: 'Clear',
                  onClick: () => self.setColorScheme(undefined),
                },
              ],
            },
            {
              label: 'Resolution',
              subMenu: [
                {
                  label: 'Finer resolution',
                  onClick: () => self.setResolution(self.resolution * 2),
                },
                {
                  label: 'Coarser resolution',
                  onClick: () => self.setResolution(self.resolution / 2),
                },
              ],
            },
          ]
        },
      }
    })
