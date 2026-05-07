import Plugin from '@jbrowse/core/Plugin'

import LinearBasicDisplayF from './LinearBasicDisplay/index.ts'
import FeatureDataRPCMethodsF from './RenderFeatureDataRPC/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class CanvasPlugin extends Plugin {
  name = 'CanvasPlugin'

  install(pluginManager: PluginManager) {
    LinearBasicDisplayF(pluginManager)
    FeatureDataRPCMethodsF(pluginManager)
  }
}

export {
  linearBasicDisplayConfigSchemaFactory,
  linearBasicDisplayStateModelFactory,
  linearCanvasBaseDisplayConfigSchemaFactory,
  linearCanvasBaseDisplayStateModelFactory,
} from './LinearBasicDisplay/index.ts'
export type { LinearBasicDisplayModel } from './LinearBasicDisplay/index.ts'
