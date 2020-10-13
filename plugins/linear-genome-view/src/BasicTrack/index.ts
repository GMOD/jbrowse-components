import {
  ConfigurationReference,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'
import { getParentRenderProps } from '@jbrowse/core/util/tracks'
import { types } from 'mobx-state-tree'
import { AnyConfigurationSchemaType } from '@jbrowse/core/configuration/configurationSchema'
import PluginManager from '@jbrowse/core/PluginManager'
import { BaseTrackConfig } from './baseTrackModel'
import BlockBasedTrackComponent from './components/BlockBasedTrack'
import blockBasedTrack from './blockBasedTrackModel'

export function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'BasicTrack',
    {
      adapter: pluginManager.pluggableConfigSchemaType('adapter'),
      renderer: pluginManager.pluggableConfigSchemaType('renderer'),
    },
    {
      baseConfiguration: BaseTrackConfig,
      explicitlyTyped: true,
    },
  )
}

export function stateModelFactory(configSchema: AnyConfigurationSchemaType) {
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
