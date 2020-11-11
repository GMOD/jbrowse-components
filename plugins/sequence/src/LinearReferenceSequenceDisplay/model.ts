import { types } from 'mobx-state-tree'
import {
  BaseLinearDisplay,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'
import { ConfigurationReference } from '@jbrowse/core/configuration'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import { getContainingView } from '@jbrowse/core/util'

export function modelFactory(configSchema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'LinearReferenceSequenceDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('LinearReferenceSequenceDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .views(self => ({
      get renderProps() {
        return {
          ...self.composedRenderProps,
          ...getParentRenderProps(self),
          config: self.configuration.renderer,
        }
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
    }))
}
