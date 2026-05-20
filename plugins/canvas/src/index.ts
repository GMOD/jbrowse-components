import Plugin from '@jbrowse/core/Plugin'

import LinearBasicDisplayF from './LinearBasicDisplay/index.ts'
import MultiBedAdapterF from './MultiBedAdapter/index.ts'
import MultiBedTrackF from './MultiBedTrack/index.ts'
import MultiLinearBasicDisplayF from './MultiLinearBasicDisplay/index.ts'
import FeatureDataRPCMethodsF from './RenderFeatureDataRPC/index.ts'
import RenderMultiBedDataRPCMethodsF from './RenderMultiBedDataRPC/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class CanvasPlugin extends Plugin {
  name = 'CanvasPlugin'

  install(pluginManager: PluginManager) {
    LinearBasicDisplayF(pluginManager)
    FeatureDataRPCMethodsF(pluginManager)
    MultiBedAdapterF(pluginManager)
    MultiBedTrackF(pluginManager)
    MultiLinearBasicDisplayF(pluginManager)
    RenderMultiBedDataRPCMethodsF(pluginManager)
  }
}

export {
  linearBasicDisplayConfigSchemaFactory,
  linearBasicDisplayStateModelFactory,
  linearCanvasBaseDisplayConfigSchemaFactory,
  linearCanvasBaseDisplayStateModelFactory,
} from './LinearBasicDisplay/index.ts'
export type { LinearBasicDisplayModel } from './LinearBasicDisplay/index.ts'
export {
  multiLinearBasicDisplayConfigSchemaFactory,
  multiLinearBasicDisplayStateModelFactory,
} from './MultiLinearBasicDisplay/index.ts'
