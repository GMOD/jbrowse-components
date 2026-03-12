import Plugin from '@jbrowse/core/Plugin'

import ChordVariantDisplayF from './ChordVariantDisplay/index.ts'
import LDDisplayF from './LDDisplay/index.ts'
import LDRendererF from './LDRenderer/index.ts'
import LDTrackF from './LDTrack/index.ts'
import LinearVariantDisplayF from './LinearVariantDisplay/index.ts'
import MultiVariantDisplayF from './MultiVariantDisplay/index.ts'
import MultiVariantMatrixDisplayF from './MultiVariantMatrixDisplay/index.ts'
import PlinkLDAdapterF from './PlinkLDAdapter/index.ts'
import LDDataRPCMethodsF from './RenderLDDataRPC/index.ts'
import SplitVcfTabixAdapterF from './SplitVcfTabixAdapter/index.ts'
import StructuralVariantChordRendererF from './StructuralVariantChordRenderer/index.ts'
import VariantFeatureWidgetF from './VariantFeatureWidget/index.ts'
import { MultiSampleVariantClusterGenotypeMatrix } from './VariantRPC/MultiSampleVariantClusterGenotypeMatrix.ts'
import { MultiSampleVariantGetCellData } from './VariantRPC/MultiSampleVariantGetCellData.ts'
import { MultiSampleVariantGetGenotypeMatrix } from './VariantRPC/MultiSampleVariantGetGenotypeMatrix.ts'
import { MultiSampleVariantGetSources } from './VariantRPC/MultiSampleVariantGetSources.ts'
import VariantTrackF from './VariantTrack/index.ts'
import VcfAdapterF from './VcfAdapter/index.ts'
import ExtensionPointsF from './VcfExtensionPoints/index.ts'
import VcfTabixAdapterF from './VcfTabixAdapter/index.ts'
import {
  calculateAlleleCounts,
  calculateMinorAlleleFrequency,
} from './shared/minorAlleleFrequencyUtils.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

export default class VariantsPlugin extends Plugin {
  name = 'VariantsPlugin'

  install(pluginManager: PluginManager) {
    VcfAdapterF(pluginManager)
    VcfTabixAdapterF(pluginManager)
    SplitVcfTabixAdapterF(pluginManager)
    PlinkLDAdapterF(pluginManager)
    VariantFeatureWidgetF(pluginManager)
    VariantTrackF(pluginManager)
    LDTrackF(pluginManager)
    ExtensionPointsF(pluginManager)
    LinearVariantDisplayF(pluginManager)
    MultiVariantDisplayF(pluginManager)
    MultiVariantMatrixDisplayF(pluginManager)
    LDDisplayF(pluginManager)
    LDRendererF(pluginManager)
    StructuralVariantChordRendererF(pluginManager)
    ChordVariantDisplayF(pluginManager)
    LDDataRPCMethodsF(pluginManager)

    pluginManager.addRpcMethod(
      () => new MultiSampleVariantGetSources(pluginManager),
    )
    pluginManager.addRpcMethod(
      () => new MultiSampleVariantGetGenotypeMatrix(pluginManager),
    )
    pluginManager.addRpcMethod(
      () => new MultiSampleVariantClusterGenotypeMatrix(pluginManager),
    )
    pluginManager.addRpcMethod(
      () => new MultiSampleVariantGetCellData(pluginManager),
    )
  }

  configure(pluginManager: PluginManager) {
    const { jexl } = pluginManager
    const splitCache = {} as Record<string, string[]>

    // Add jexl function to calculate MAF for a feature
    jexl.addFunction('maf', (feature: Feature) => {
      const genotypes = feature.get('genotypes') as
        | Record<string, string>
        | undefined
      if (!genotypes) {
        return 0
      }
      const alleleCounts = calculateAlleleCounts(genotypes, splitCache)
      return calculateMinorAlleleFrequency(alleleCounts)
    })
  }
}

export { default as VcfFeature } from './VcfFeature/index.ts'
