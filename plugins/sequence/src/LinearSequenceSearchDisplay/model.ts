import { types } from 'mobx-state-tree'
import {
  BaseLinearDisplay,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import {
  AnyConfigurationSchemaType,
  ConfigurationReference,
} from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'

export function modelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearSequenceSearchDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('LinearSequenceSearchDisplay'),
        configuration: ConfigurationReference(configSchema),
        height: 180,
      }),
    )
    .views(self => {
      const { renderProps: superRenderProps } = self
      return {
        renderProps() {
          return {
            ...superRenderProps(),
            rpcDriverName: self.rpcDriverName,
            config: self.configuration.renderer,
          }
        },
        get blockType() {
          return 'dynamicBlocks'
        },
        regionCannotBeRendered(/* region */) {
          const view = getContainingView(self) as LinearGenomeViewModel
          if (view && view.bpPerPx >= 1) {
            return 'Zoom in to see sequence'
          }
          return undefined
        },

        get rendererTypeName() {
          return self.configuration.renderer.type
        },
      }
    })
}
