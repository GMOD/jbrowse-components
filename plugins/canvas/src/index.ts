import Plugin from '@jbrowse/core/Plugin'

import CanvasFeatureGpuHandler from './CanvasFeatureGpuHandler.ts'
import LinearWebGLFeatureDisplayF from './LinearWebGLFeatureDisplay/index.ts'
import WebGLFeatureDataRPCMethodsF from './RenderWebGLFeatureDataRPC/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class CanvasPlugin extends Plugin {
  name = 'CanvasPlugin'

  install(pluginManager: PluginManager) {
    LinearWebGLFeatureDisplayF(pluginManager)
    WebGLFeatureDataRPCMethodsF(pluginManager)
    pluginManager.addGpuHandler(() => new CanvasFeatureGpuHandler(pluginManager))
  }
}

export {
  linearWebGLFeatureDisplayConfigSchemaFactory,
  linearWebGLFeatureDisplayStateModelFactory,
} from './LinearWebGLFeatureDisplay/index.ts'
export type { LinearWebGLFeatureDisplayModel } from './LinearWebGLFeatureDisplay/index.ts'
