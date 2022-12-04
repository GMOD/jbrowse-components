import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import BamAdapterF from './CramAdapter'
import CramAdapterF from './BamAdapter'
import HtsgetBamAdapterF from './HtsgetBamAdapter'
import SNPCoverageAdapterF from './SNPCoverageAdapter'
import SNPCoverageRendererF from './SNPCoverageRenderer'
import PileupRendererF from './PileupRenderer'
import LinearAlignmentsDisplayF from './LinearAlignmentsDisplay'
import LinearSNPCoverageDisplayF from './LinearSNPCoverageDisplay'
import LinearAlignmentsArcsDisplayF from './LinearAlignmentsArcsDisplay'
import LinearAlignmentsCloudDisplayF from './LinearAlignmentsCloudDisplay'
import AlignmentsTrackF from './AlignmentsTrack'
import AlignmentsFeatureWidgetF from './AlignmentsFeatureDetail'
import PileupRPCMethodsF from './PileupRPC'
import GuessAlignmentsTypesF from './GuessAlignmentsTypes'
import LinearPileupDisplayF, {
  linearPileupDisplayStateModelFactory,
  linearPileupDisplayConfigSchemaFactory,
} from './LinearPileupDisplay'
import { LinearPileupDisplayModel } from './LinearPileupDisplay/model'
import * as MismatchParser from './BamAdapter/MismatchParser'

export default class AlignmentsPlugin extends Plugin {
  name = 'AlignmentsPlugin'

  install(pluginManager: PluginManager) {
    ;[
      CramAdapterF,
      BamAdapterF,
      LinearPileupDisplayF,
      LinearSNPCoverageDisplayF,
      AlignmentsTrackF,
      SNPCoverageAdapterF,
      HtsgetBamAdapterF,
      PileupRendererF,
      PileupRPCMethodsF,
      SNPCoverageRendererF,
      LinearAlignmentsArcsDisplayF,
      LinearAlignmentsCloudDisplayF,
      LinearAlignmentsDisplayF,
      AlignmentsFeatureWidgetF,
      GuessAlignmentsTypesF,
    ].map(f => f(pluginManager))
  }
}

export {
  linearPileupDisplayConfigSchemaFactory,
  linearPileupDisplayStateModelFactory,
  MismatchParser,
}
export type { LinearPileupDisplayModel }
