import {
  ConfigurationReference,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { types } from 'mobx-state-tree'
import { BaseTrackConfig } from './baseTrackModel'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function configSchemaFactory(pluginManager: any) {
  return ConfigurationSchema(
    'LinearSyntenyTrack',
    {
      viewType: 'LinearSyntenyView',
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    {
      baseConfiguration: BaseTrackConfig,
      explicitlyTyped: true,
    },
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stateModelFactory(configSchema: any) {
  return types
    .model('LinearSyntenyTrack', {
      type: types.literal('LinearSyntenyTrack'),
      configuration: ConfigurationReference(configSchema),
      height: 100,
    })

    .views(self => ({
      get renderProps() {
        return {
          ...getParentRenderProps(self),
          config: self.configuration.renderer,
        }
      },

      get rendererTypeName() {
        return self.configuration.renderer.type
      },
    }))
}

export type SyntenyTrackStateModel = ReturnType<typeof stateModelFactory>
