import Plugin from '@jbrowse/core/Plugin'

import CanvasFeatureRendererF from './CanvasFeatureRenderer/index.ts'
import LinearWebGLFeatureDisplayF from './LinearWebGLFeatureDisplay/index.ts'
import WebGLFeatureDataRPCMethodsF from './RenderWebGLFeatureDataRPC/index.ts'
import registerGlyphs from './glyphs/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class CanvasPlugin extends Plugin {
  name = 'CanvasPlugin'

  install(pluginManager: PluginManager) {
    registerGlyphs(pluginManager)
    CanvasFeatureRendererF(pluginManager)
    LinearWebGLFeatureDisplayF(pluginManager)
    WebGLFeatureDataRPCMethodsF(pluginManager)
  }
}

export {
  linearWebGLFeatureDisplayConfigSchemaFactory,
  linearWebGLFeatureDisplayStateModelFactory,
} from './LinearWebGLFeatureDisplay/index.ts'
export type { LinearWebGLFeatureDisplayModel } from './LinearWebGLFeatureDisplay/index.ts'
