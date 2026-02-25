import Plugin from '@jbrowse/core/Plugin'

import LinearBasicDisplayF from './LinearBasicDisplay/index.ts'
import LinearFeatureDisplayF from './LinearFeatureDisplay/index.ts'
import FeatureDataRPCMethodsF from './RenderFeatureDataRPC/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class CanvasPlugin extends Plugin {
  name = 'CanvasPlugin'

  install(pluginManager: PluginManager) {
    LinearFeatureDisplayF(pluginManager)
    LinearBasicDisplayF(pluginManager)
    FeatureDataRPCMethodsF(pluginManager)
  }
}

export {
  linearFeatureDisplayConfigSchemaFactory,
  linearFeatureDisplayStateModelFactory,
} from './LinearFeatureDisplay/index.ts'
export type { LinearFeatureDisplayModel } from './LinearFeatureDisplay/index.ts'
