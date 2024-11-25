import Plugin from '@jbrowse/core/Plugin'
import AlignmentsFeatureWidgetF from './AlignmentsFeatureDetail'
import AlignmentsTrackF from './AlignmentsTrack'
import CramAdapterF from './BamAdapter'
import BamAdapterF from './CramAdapter'
import GuessAlignmentsTypesF from './GuessAlignmentsTypes'
import HtsgetBamAdapterF from './HtsgetBamAdapter'
import LinearAlignmentsDisplayF from './LinearAlignmentsDisplay'
import LinearPileupDisplayF from './LinearPileupDisplay'
import LinearReadArcsDisplayF from './LinearReadArcsDisplay'
import LinearReadCloudDisplayF from './LinearReadCloudDisplay'
import LinearSNPCoverageDisplayF from './LinearSNPCoverageDisplay'
import PileupRPCMethodsF from './PileupRPC'
import PileupRendererF from './PileupRenderer'
import SNPCoverageAdapterF from './SNPCoverageAdapter'
import SNPCoverageRendererF from './SNPCoverageRenderer'
import type PluginManager from '@jbrowse/core/PluginManager'

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
    ].map(f => {
      f(pluginManager)
    })
  }
}

export {
  linearPileupDisplayStateModelFactory,
  linearPileupDisplayConfigSchemaFactory,
  SharedLinearPileupDisplayMixin,
} from './LinearPileupDisplay'
export { type LinearPileupDisplayModel } from './LinearPileupDisplay/model'
export * as MismatchParser from './MismatchParser'
