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
import LinearReadArcsDisplayF from './LinearReadArcsDisplay'
import LinearReadCloudDisplayF from './LinearReadCloudDisplay'
import AlignmentsTrackF from './AlignmentsTrack'
import AlignmentsFeatureWidgetF from './AlignmentsFeatureDetail'
import PileupRPCMethodsF from './PileupRPC'
import GuessAlignmentsTypesF from './GuessAlignmentsTypes'
import LinearPileupDisplayF from './LinearPileupDisplay'

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
      LinearReadArcsDisplayF,
      LinearReadCloudDisplayF,
      LinearAlignmentsDisplayF,
      AlignmentsFeatureWidgetF,
      GuessAlignmentsTypesF,
    ].map(f => f(pluginManager))
  }
}

export {
  linearPileupDisplayStateModelFactory,
  linearPileupDisplayConfigSchemaFactory,
} from './LinearPileupDisplay'
export { type LinearPileupDisplayModel } from './LinearPileupDisplay/model'
export * as MismatchParser from './MismatchParser'
