import { lazy } from 'react'
import { configSchema, stateModelFactory } from './BaseFeatureWidget'
import Plugin from './Plugin'
import PluginManager from './PluginManager'
import * as coreRpcMethods from './rpc/coreRpcMethods'
import AdapterType from './pluggableElementTypes/AdapterType'
import WidgetType from './pluggableElementTypes/WidgetType'
import {
  configSchema as cytobandConfigSchema,
  DataAdapter,
} from './data_adapters/CytobandAdapter'

// the core plugin, which registers types that ALL JBrowse applications are
// expected to need.
export default class CorePlugin extends Plugin {
  name = 'CorePlugin'

  install(pluginManager: PluginManager) {
    // register all our core rpc methods
    Object.values(coreRpcMethods).forEach(RpcMethod => {
      pluginManager.addRpcMethod(() => new RpcMethod(pluginManager))
    })

    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'CytobandAdapter',
          configSchema: cytobandConfigSchema,
          AdapterClass: DataAdapter,
        }),
    )

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'BaseFeatureWidget',
        heading: 'Feature details',
        configSchema,
        stateModel: stateModelFactory(pluginManager),
        ReactComponent: lazy(
          () => import('./BaseFeatureWidget/BaseFeatureDetail'),
        ),
      })
    })
  }
}
