import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
  getConf,
} from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'
import { BaseLinearDisplay } from '@jbrowse/plugin-linear-genome-view'
import { getEnv } from '@jbrowse/core/util'

export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearArcDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('LinearArcDisplay'),
        configuration: ConfigurationReference(configSchema),
        semicircles: types.maybe(types.boolean),
      }),
    )

    .views(self => ({
      get blockType() {
        return 'staticBlocks'
      },
      get renderDelay() {
        return 500
      },

      get rendererTypeName() {
        return self.configuration.renderer.type
      },
    }))
    .views(self => ({
      get semicirclesSetting() {
        return self.semicircles ?? getConf(self, ['renderer', 'semicircles'])
      },
    }))
    .views(self => ({
      get rendererConfig() {
        const configBlob = getConf(self, ['renderer']) || {}
        const config = configBlob as Omit<typeof configBlob, symbol>
        return self.rendererType.configSchema.create(
          {
            ...config,
            semicircles: self.semicirclesSetting,
          },
          getEnv(self),
        )
      },
    }))
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
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
      setSemiCircles(flag: boolean) {
        self.semicircles = flag
      },
    }))
    .views(self => {
      const superMenuItems = self.trackMenuItems
      return {
        trackMenuItems() {
          return [
            ...superMenuItems(),
            {
              label: 'Render semi-circles',
              type: 'checkbox',
              checked: self.semicirclesSetting,
              onClick: () => self.setSemiCircles(!self.semicirclesSetting),
            },
          ]
        },
      }
    })
}
