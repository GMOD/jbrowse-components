import { lazy } from 'react'

import { configSchema, stateModelFactory } from './BaseFeatureWidget/index.ts'
import Plugin from './Plugin.ts'
import CytobandAdapterF from './data_adapters/CytobandAdapter/index.ts'
import WidgetType from './pluggableElementTypes/WidgetType.ts'
import * as coreRpcMethods from './rpc/coreRpcMethods.ts'

import type PluginManager from './PluginManager.ts'

// the core plugin, which registers types that ALL JBrowse applications are
// expected to need.
export default class CorePlugin extends Plugin {
  name = 'CorePlugin'

  install(pluginManager: PluginManager) {
    // register all our core rpc methods
    for (const RpcMethod of Object.values(coreRpcMethods)) {
      pluginManager.addRpcMethod(() => new RpcMethod(pluginManager))
    }

    CytobandAdapterF(pluginManager)

    pluginManager.addWidgetType(() => {
      return new WidgetType({
        name: 'BaseFeatureWidget',
        heading: 'Feature details',
        configSchema,
        stateModel: stateModelFactory(pluginManager),
        ReactComponent: lazy(
          () => import('./BaseFeatureWidget/BaseFeatureDetail/index.tsx'),
        ),
      })
    })
  }
}
