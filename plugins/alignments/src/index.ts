import Plugin from '@jbrowse/core/Plugin'

import AlignmentsFeatureWidgetF from './AlignmentsFeatureDetail/index.ts'
import AlignmentsTrackF from './AlignmentsTrack/index.ts'
import CramAdapterF from './BamAdapter/index.ts'
import BamAdapterF from './CramAdapter/index.ts'
import GuessAlignmentsTypesF from './GuessAlignmentsTypes/index.ts'
import HtsgetBamAdapterF from './HtsgetBamAdapter/index.ts'
import LinearAlignmentsDisplayF from './LinearAlignmentsDisplay/index.ts'
import ArcsDataRPCMethodsF from './RenderArcsDataRPC/index.ts'
import ChainDataRPCMethodsF from './RenderChainDataRPC/index.ts'
import PileupDataRPCMethodsF from './RenderPileupDataRPC/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class AlignmentsPlugin extends Plugin {
  name = 'AlignmentsPlugin'

  install(pluginManager: PluginManager) {
    ;[
      CramAdapterF,
      BamAdapterF,
      AlignmentsTrackF,
      HtsgetBamAdapterF,
      PileupDataRPCMethodsF,
      ArcsDataRPCMethodsF,
      ChainDataRPCMethodsF,
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
export {
  featurizeSA,
  getClip,
  getLength,
  getLengthSansClipping,
  getMismatches,
  getTag,
  parseCigar2,
  parseCigar,
} from './MismatchParser/index.ts'
