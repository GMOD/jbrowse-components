import Plugin from '@jbrowse/core/Plugin'

import AlignmentsFeatureWidgetF from './AlignmentsFeatureDetail/index.ts'
import AlignmentsTrackF from './AlignmentsTrack/index.ts'
import BamAdapterF from './BamAdapter/index.ts'
import CramAdapterF from './CramAdapter/index.ts'
import GuessAlignmentsTypesF from './GuessAlignmentsTypes/index.ts'
import HtsgetBamAdapterF from './HtsgetBamAdapter/index.ts'
import LinearAlignmentsDisplayF from './LinearAlignmentsDisplay/index.ts'
import ChainDataRPCMethodsF from './RenderChainDataRPC/index.ts'
import PileupDataRPCMethodsF from './RenderPileupDataRPC/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class AlignmentsPlugin extends Plugin {
  name = 'AlignmentsPlugin'

  install(pluginManager: PluginManager) {
    for (const f of [
      CramAdapterF,
      BamAdapterF,
      AlignmentsTrackF,
      HtsgetBamAdapterF,
      PileupDataRPCMethodsF,
      ChainDataRPCMethodsF,
      LinearAlignmentsDisplayF,
      AlignmentsFeatureWidgetF,
      GuessAlignmentsTypesF,
    ]) {
      f(pluginManager)
    }
  }
}

export {
  linearAlignmentsDisplayConfigSchemaFactory,
  linearAlignmentsDisplayStateModelFactory,
} from './LinearAlignmentsDisplay/index.ts'
export type { LinearAlignmentsDisplayModel } from './LinearAlignmentsDisplay/model.ts'
export {
  getColorByMenuItem,
  getFeatureHeightMenuItem,
  getFiltersMenuItem,
  getGroupByMenuItem,
  getSetMaxHeightMenuItem,
  getShowMenuItem,
  getSortByMenuItem,
} from './shared/menuItems.ts'
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
export { computeCoverage } from './shared/computeCoverage.ts'
export type { CoverageFeature } from './shared/computeCoverage.ts'
export { computeSNPCoverage } from '@jbrowse/alignments-core'
export type { MismatchEntry } from '@jbrowse/alignments-core'
export { default as CoverageYScaleBar } from './LinearAlignmentsDisplay/components/CoverageYScaleBar.tsx'
export type { CoverageTicks } from './LinearAlignmentsDisplay/components/CoverageYScaleBar.tsx'
export { CoverageTooltipContents } from './LinearAlignmentsDisplay/components/AlignmentsTooltip.tsx'
export type { CoverageTooltipBin } from '@jbrowse/alignments-core'
