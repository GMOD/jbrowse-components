import { lazy } from 'react'
import { configSchema, stateModelFactory } from './BaseFeatureWidget'
import Plugin from './Plugin'
import CytobandAdapterF from './data_adapters/CytobandAdapter'
import WidgetType from './pluggableElementTypes/WidgetType'
import * as coreRpcMethods from './rpc/coreRpcMethods'
import type PluginManager from './PluginManager'

// the core plugin, which registers types that ALL JBrowse applications are
// expected to need.
export default class CorePlugin extends Plugin {
  name = 'CorePlugin'

  install(pluginManager: PluginManager) {
    // register all our core rpc methods
    Object.values(coreRpcMethods).forEach(RpcMethod => {
      pluginManager.addRpcMethod(() => new RpcMethod(pluginManager))
    })

    CytobandAdapterF(pluginManager)

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
