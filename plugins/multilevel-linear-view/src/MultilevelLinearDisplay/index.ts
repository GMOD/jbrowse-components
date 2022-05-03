import { types, Instance } from 'mobx-state-tree'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import {
  getConf,
  ConfigurationReference,
  ConfigurationSchema,
} from '@jbrowse/core/configuration'
import PluginManager from '@jbrowse/core/PluginManager'
import { getContainingView } from '@jbrowse/core/util'
import {
  configSchemaFactory as baseConfigFactory,
  stateModelFactory as baseModelFactory,
  ReactComponent,
} from '../MultilevelLinearComparativeDisplay'
import { MultilevelLinearViewModel } from '../MultilevelLinearView/model'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'MultilevelLinearDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'MultilevelTrack',
      viewType: 'MultilevelLinearView',
      ReactComponent,
    })
  })
}

export function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'MultilevelLinearDisplay',
    {
      trackIds: {
        type: 'stringArray',
        defaultValue: [],
      },
      renderer: 'SvgFeatureRenderer',
      middle: { type: 'boolean', defaultValue: true },
    },
    {
      baseConfiguration: baseConfigFactory(pluginManager),
      explicitlyTyped: true,
    },
  )
}

export function stateModelFactory(
  configSchema: ReturnType<typeof configSchemaFactory>,
) {
  return types
    .compose(
      'MultilevelLinearDisplay',
      baseModelFactory(configSchema),
      types.model({
        type: types.literal('MultilevelLinearDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )

    .views(self => ({
      renderProps() {
        const parentView = getContainingView(self) as MultilevelLinearViewModel
        return {
          rpcDriverName: self.rpcDriverName,
          displayModel: self,
          config: getConf(self, 'renderer'),
          width: parentView.width,
          height: parentView.middleComparativeHeight,
        }
      },
      get rendererTypeName() {
        return self.configuration.renderer.type
      },
      get adapterConfig() {
        // TODO possibly enriches with the adapters from associated trackIds
        return {
          name: self.parentTrack.configuration.adapter.type,
          assemblyNames: getConf(self, 'assemblyNames'),
          ...getConf(self.parentTrack, 'adapter'),
        }
      },

      get trackIds() {
        return getConf(self, 'trackIds') as string[]
      },
    }))
}

export type MultilevelLinearDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type MultilevelLinearDisplayModel =
  Instance<MultilevelLinearDisplayStateModel>
