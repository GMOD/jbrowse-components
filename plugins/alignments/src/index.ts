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
} from './shared/menus/index.ts'
export { CoverageTooltipContents } from './LinearAlignmentsDisplay/components/AlignmentsTooltip.tsx'
