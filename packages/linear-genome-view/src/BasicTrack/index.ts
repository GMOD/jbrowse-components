import {
  ConfigurationReference,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'
import { getParentRenderProps } from '@gmod/jbrowse-core/util/tracks'
import { types } from 'mobx-state-tree'
import { BaseTrackConfig } from './baseTrackModel'
import BlockBasedTrackComponent from './components/BlockBasedTrack'
import blockBasedTrack from './blockBasedTrackModel'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function configSchemaFactory(pluginManager: any) {
  return ConfigurationSchema(
    'BasicTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    { baseConfiguration: BaseTrackConfig, explicitlyTyped: true },
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stateModelFactory(configSchema: any) {
  return types
    .compose(
      'BasicTrack',
      blockBasedTrack,
      types.model({
        type: types.literal('BasicTrack'),
        configuration: ConfigurationReference(configSchema),
        height: 100,
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

      get rendererTypeName() {
        return self.configuration.renderer.type
      },
    }))
    .volatile(() => ({
      ReactComponent: BlockBasedTrackComponent,
    }))
}

export type BasicTrackStateModel = ReturnType<typeof stateModelFactory>
