import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
  getConf,
} from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { getEnv } from '@jbrowse/core/util'

/**
 * #stateModel LinearArcDisplay
 * extends
 * - [BaseLinearDisplay](../baselineardisplay)
 */
export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearArcDisplay',
      BaseLinearDisplay,
      types.model({
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),

        /**
         * #property
         */
        displayMode: types.maybe(types.string),

        /**
         * #property
         */
        type: types.literal('LinearArcDisplay'),
      }),
    )

    .views(self => ({
      /**
       * #getter
       */
      get blockType() {
        return 'staticBlocks'
      },
      /**
       * #getter
       */
      get renderDelay() {
        return 500
      },
      /**
       * #getter
       */
      get rendererTypeName() {
        return self.configuration.renderer.type
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get displayModeSetting() {
        return self.displayMode ?? getConf(self, ['renderer', 'displayMode'])
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get rendererConfig() {
        const configBlob = getConf(self, ['renderer']) || {}
        const config = configBlob as Omit<typeof configBlob, symbol>
        return self.rendererType.configSchema.create(
          {
            ...config,
            displayMode: self.displayModeSetting,
          },
          getEnv(self),
        )
      },
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        /**
         * #method
         */
        renderProps() {
          return {
            ...superRenderProps(),
            config: self.rendererConfig,
            height: self.height,
            rpcDriverName: self.rpcDriverName,
          }
        },
      }
    })
    .actions(self => ({
      /**
       * #action
       */
      setDisplayMode(flag: string) {
        self.displayMode = flag
      },
    }))
    .views(self => {
      const superMenuItems = self.trackMenuItems
      return {
        /**
         * #method
         */
        trackMenuItems() {
          return [
            ...superMenuItems(),
            {
              label: 'Display mode',
              subMenu: [
                {
                  checked: self.displayMode === 'arcs',
                  label: 'Arcs',
                  onClick: () => self.setDisplayMode('arcs'),
                  type: 'radio',
                },
                {
                  checked: self.displayMode === 'semicircles',
                  label: 'Semi-circles',
                  onClick: () => self.setDisplayMode('semicircles'),
                  type: 'radio',
                },
              ],
            },
          ]
        },
      }
    })
}
