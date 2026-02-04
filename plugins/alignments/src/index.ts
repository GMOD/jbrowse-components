import Plugin from '@jbrowse/core/Plugin'

import AlignmentsFeatureWidgetF from './AlignmentsFeatureDetail/index.ts'
import AlignmentsTrackF from './AlignmentsTrack/index.ts'
import CramAdapterF from './BamAdapter/index.ts'
import BamAdapterF from './CramAdapter/index.ts'
import GuessAlignmentsTypesF from './GuessAlignmentsTypes/index.ts'
import HtsgetBamAdapterF from './HtsgetBamAdapter/index.ts'
import LinearAlignmentsDisplayF from './LinearAlignmentsDisplay/index.ts'
import LinearPileupDisplayF from './LinearPileupDisplay/index.ts'
import LinearWebGLPileupDisplayF from './LinearWebGLPileupDisplay/index.ts'
import LinearReadArcsDisplayF from './LinearReadArcsDisplay/index.ts'
import LinearReadCloudDisplayF from './LinearReadCloudDisplay/index.ts'
import LinearSNPCoverageDisplayF from './LinearSNPCoverageDisplay/index.ts'
import PileupRPCMethodsF from './PileupRPC/index.ts'
import PileupRendererF from './PileupRenderer/index.ts'
import LinearReadArcsDisplayRPCMethodsF from './RenderLinearReadArcsDisplayRPC/index.ts'
import LinearReadCloudDisplayRPCMethodsF from './RenderLinearReadCloudDisplayRPC/index.ts'
import WebGLPileupDataRPCMethodsF from './RenderWebGLPileupDataRPC/index.ts'
import SNPCoverageAdapterF from './SNPCoverageAdapter/index.ts'
import SNPCoverageRendererF from './SNPCoverageRenderer/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class AlignmentsPlugin extends Plugin {
  name = 'AlignmentsPlugin'

  install(pluginManager: PluginManager) {
    ;[
      CramAdapterF,
      BamAdapterF,
      LinearPileupDisplayF,
      LinearWebGLPileupDisplayF,
      LinearSNPCoverageDisplayF,
      AlignmentsTrackF,
      SNPCoverageAdapterF,
      HtsgetBamAdapterF,
      PileupRendererF,
      PileupRPCMethodsF,
      LinearReadArcsDisplayRPCMethodsF,
      LinearReadCloudDisplayRPCMethodsF,
      WebGLPileupDataRPCMethodsF,
      SNPCoverageRendererF,
      LinearReadArcsDisplayF,
      LinearReadCloudDisplayF,
      LinearAlignmentsDisplayF,
      AlignmentsFeatureWidgetF,
      GuessAlignmentsTypesF,
    ].map(f => {
      f(pluginManager)
    })
  }
}

export {
  SharedLinearPileupDisplayMixin,
  linearPileupDisplayConfigSchemaFactory,
  linearPileupDisplayStateModelFactory,
} from './LinearPileupDisplay/index.ts'
export { type LinearPileupDisplayModel } from './LinearPileupDisplay/model.ts'
export {
  linearWebGLPileupDisplayConfigSchemaFactory,
  linearWebGLPileupDisplayStateModelFactory,
} from './LinearWebGLPileupDisplay/index.ts'
export { type LinearWebGLPileupDisplayModel } from './LinearWebGLPileupDisplay/model.ts'
export * as MismatchParser from './MismatchParser/index.ts'
