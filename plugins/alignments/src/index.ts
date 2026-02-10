import Plugin from '@jbrowse/core/Plugin'

import AlignmentsFeatureWidgetF from './AlignmentsFeatureDetail/index.ts'
import AlignmentsTrackF from './AlignmentsTrack/index.ts'
import CramAdapterF from './BamAdapter/index.ts'
import BamAdapterF from './CramAdapter/index.ts'
import GuessAlignmentsTypesF from './GuessAlignmentsTypes/index.ts'
import HtsgetBamAdapterF from './HtsgetBamAdapter/index.ts'
import LinearAlignmentsDisplayF from './LinearAlignmentsDisplay/index.ts'
import WebGLArcsDataRPCMethodsF from './RenderWebGLArcsDataRPC/index.ts'
import WebGLChainDataRPCMethodsF from './RenderWebGLChainDataRPC/index.ts'
import WebGLCloudDataRPCMethodsF from './RenderWebGLCloudDataRPC/index.ts'
import WebGLPileupDataRPCMethodsF from './RenderWebGLPileupDataRPC/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class AlignmentsPlugin extends Plugin {
  name = 'AlignmentsPlugin'

  install(pluginManager: PluginManager) {
    ;[
      CramAdapterF,
      BamAdapterF,
      AlignmentsTrackF,
      HtsgetBamAdapterF,
      WebGLPileupDataRPCMethodsF,
      WebGLArcsDataRPCMethodsF,
      WebGLChainDataRPCMethodsF,
      WebGLCloudDataRPCMethodsF,
      LinearAlignmentsDisplayF,
      AlignmentsFeatureWidgetF,
      GuessAlignmentsTypesF,
    ].map(f => {
      f(pluginManager)
    })
  }
}

export {
  linearAlignmentsDisplayConfigSchemaFactory,
  linearAlignmentsDisplayStateModelFactory,
} from './LinearAlignmentsDisplay/index.ts'
export type { LinearAlignmentsDisplayModel } from './LinearAlignmentsDisplay/model.ts'
export * as MismatchParser from './MismatchParser/index.ts'
