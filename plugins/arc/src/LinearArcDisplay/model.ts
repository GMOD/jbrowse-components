import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { getEnv } from '@jbrowse/core/util'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { types } from 'mobx-state-tree'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

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
        type: types.literal('LinearArcDisplay'),
        /**
         * #property
         */
        configuration: ConfigurationReference(configSchema),
        /**
         * #property
         */
        displayMode: types.maybe(types.string),
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
            rpcDriverName: self.rpcDriverName,
            config: self.rendererConfig,
            height: self.height,
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
                  type: 'radio',
                  label: 'Arcs',
                  onClick: () => {
                    self.setDisplayMode('arcs')
                  },
                  checked: self.displayMode === 'arcs',
                },
                {
                  type: 'radio',
                  label: 'Semi-circles',
                  onClick: () => {
                    self.setDisplayMode('semicircles')
                  },
                  checked: self.displayMode === 'semicircles',
                },
              ],
            },
          ]
        },
      }
    })
}
