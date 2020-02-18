import {
  ConfigurationReference,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { types, Instance } from 'mobx-state-tree'
import { BaseTrackConfig } from '@gmod/jbrowse-plugin-linear-genome-view'
import LinearComparativeTrackComponent from './components/LinearComparativeTrack'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function configSchemaFactory(pluginManager: any) {
  return ConfigurationSchema(
    'LinearComparativeTrack',
    {
      viewType: 'LinearComparativeView',
      trackIds: {
        type: 'stringArray',
        defaultValue: [],
      },
      middle: {
        type: 'boolean',
        defaultValue: true,
      },
      hideTiny: {
        type: 'boolean',
        defaultValue: true,
      },
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
export function stateModelFactory(pluginManager: any, configSchema: any) {
  return types
    .model('LinearComparativeTrack', {
      type: types.literal('LinearComparativeTrack'),
      configuration: ConfigurationReference(configSchema),
    })
    .volatile(self => ({
      ReactComponent: (LinearComparativeTrackComponent as unknown) as React.FC,
    }))

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

export type LinearComparativeTrack = ReturnType<typeof stateModelFactory>
export type LinearComparativeTrackModel = Instance<LinearComparativeTrack>
