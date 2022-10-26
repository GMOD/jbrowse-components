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
} from '../LinearComparativeDisplay'
import { LinearSyntenyViewModel } from '../LinearSyntenyView/model'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearSyntenyDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'SyntenyTrack',
      viewType: 'LinearSyntenyView',
      ReactComponent,
    })
  })
}

/**
 * #config LinearSyntenyDisplay
 */
export function configSchemaFactory(pluginManager: PluginManager) {
  return ConfigurationSchema(
    'LinearSyntenyDisplay',
    {
      /**
       * #slot
       * currently unused
       */
      trackIds: {
        type: 'stringArray',
        defaultValue: [],
      },
      /**
       * #slot
       */
      renderer: types.optional(
        pluginManager.pluggableConfigSchemaType('renderer'),
        { type: 'LinearSyntenyRenderer' },
      ),

      /**
       * #slot
       * currently unused
       */
      middle: { type: 'boolean', defaultValue: true },
    },
    {
      /**
       * #baseConfiguration
       * this refers to the base linear comparative display
       */
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
      'LinearSyntenyDisplay',
      baseModelFactory(configSchema),
      types.model({
        type: types.literal('LinearSyntenyDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )

    .views(self => ({
      renderProps() {
        const parentView = getContainingView(self) as LinearSyntenyViewModel
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
          // @ts-ignore
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

export type LinearSyntenyDisplayStateModel = ReturnType<
  typeof stateModelFactory
>
export type LinearSyntenyDisplayModel = Instance<LinearSyntenyDisplayStateModel>
