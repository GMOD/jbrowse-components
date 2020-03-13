import { ConfigurationSchema } from '@gmod/jbrowse-core/configuration'
import { Instance } from 'mobx-state-tree'
import {
  BaseTrackConfig,
  BaseTrack,
} from '@gmod/jbrowse-plugin-linear-genome-view'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function configSchemaFactory(pluginManager: any) {
  return ConfigurationSchema(
    'LinearComparativeTrack',
    {
      viewType: 'LinearComparativeView',
      middle: {
        type: 'boolean',
        defaultValue: true,
      },
    },
    {
      baseConfiguration: BaseTrackConfig,
      explicitlyTyped: true,
    },
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stateModelFactory(pluginManager: any, configSchema: any) {
  return BaseTrack.named('LinearComparativeTrack')
}

export type LinearComparativeTrack = ReturnType<typeof stateModelFactory>
export type LinearComparativeTrackModel = Instance<LinearComparativeTrack>
