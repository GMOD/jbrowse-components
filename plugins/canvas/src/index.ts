import Plugin from '@jbrowse/core/Plugin'

import LinearBasicDisplayF from './LinearBasicDisplay/index.ts'
import { highlightSearchResultFeature } from './LinearBasicDisplay/searchResultHighlight.ts'
import LinearMultiRowFeatureDisplayF from './LinearMultiRowFeatureDisplay/index.ts'
import MultiRowGetFeaturesRPCMethodF from './MultiRowGetFeaturesRPC/index.ts'
import FeatureDataRPCMethodsF from './RenderFeatureDataRPC/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class CanvasPlugin extends Plugin {
  name = 'CanvasPlugin'

  install(pluginManager: PluginManager) {
    LinearBasicDisplayF(pluginManager)
    LinearMultiRowFeatureDisplayF(pluginManager)
    FeatureDataRPCMethodsF(pluginManager)
    MultiRowGetFeaturesRPCMethodF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    // When a text-search result is chosen, highlight the specific feature on
    // its canvas display (not just the navigated region).
    pluginManager.addToExtensionPoint(
      'LinearGenomeView-searchResultSelected',
      (arg, { result, model, assemblyName }) => {
        highlightSearchResultFeature({ result, model, assemblyName })
        return arg
      },
    )
  }
}

export {
  linearBasicDisplayConfigSchemaFactory,
  linearBasicDisplayStateModelFactory,
  linearCanvasBaseDisplayConfigSchemaFactory,
  linearCanvasBaseDisplayStateModelFactory,
} from './LinearBasicDisplay/index.ts'
export type { LinearBasicDisplayModel } from './LinearBasicDisplay/index.ts'
