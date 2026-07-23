import Plugin from '@jbrowse/core/Plugin'

import LDDisplayF from './LDDisplay/index.ts'
import LDTrackF from './LDTrack/index.ts'
import LinearMultiSampleVariantDisplayF from './LinearMultiSampleVariantDisplay/index.ts'
import LinearMultiSampleVariantMatrixDisplayF from './LinearMultiSampleVariantMatrixDisplay/index.ts'
import LinearVariantDisplayF from './LinearVariantDisplay/index.ts'
import PlinkLDAdapterF from './PlinkLDAdapter/index.ts'
import LDDataRPCMethodsF from './RenderLDDataRPC/index.ts'
import SplitVcfTabixAdapterF from './SplitVcfTabixAdapter/index.ts'
import VariantFeatureWidgetF from './VariantFeatureWidget/index.ts'
import { MultiSampleVariantClusterGenotypeMatrix } from './VariantRPC/MultiSampleVariantClusterGenotypeMatrix.ts'
import { MultiSampleVariantGetCellData } from './VariantRPC/MultiSampleVariantGetCellData.ts'
import { MultiSampleVariantGetGenotypeMatrix } from './VariantRPC/MultiSampleVariantGetGenotypeMatrix.ts'
import { MultiSampleVariantGetSources } from './VariantRPC/MultiSampleVariantGetSources.ts'
import VariantTrackF from './VariantTrack/index.ts'
import VcfAdapterF from './VcfAdapter/index.ts'
import ExtensionPointsF from './VcfExtensionPoints/index.ts'
import VcfTabixAdapterF from './VcfTabixAdapter/index.ts'
import { calculateAlleleCounts } from './shared/alleleCounts.ts'
import {
  calculateMinorAlleleFrequency,
  calculateMissingnessFrequency,
} from './shared/minorAlleleFrequencyUtils.ts'
import {
  getVariantConsequence,
  getVariantImpact,
  getVariantImpactColor,
} from './shared/variantConsequence.ts'
import { getVariantSvTypeColor } from './shared/variantSvType.ts'

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
    LinearMultiSampleVariantDisplayF(pluginManager)
    LinearMultiSampleVariantMatrixDisplayF(pluginManager)
    LDDisplayF(pluginManager)
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

    // Both jexl filters share the same genotypes->allele-count scan. Returns
    // undefined (no allocation) when a feature carries no genotypes, so the
    // callers keep their 0 fallback without building an empty counts object.
    const featureAlleleCounts = (feature: Feature) => {
      const genotypes = feature.get('genotypes') as
        | Record<string, string>
        | undefined
      return genotypes ? calculateAlleleCounts(genotypes) : undefined
    }
    jexl.addFunction('maf', (feature: Feature) => {
      const counts = featureAlleleCounts(feature)
      return counts ? calculateMinorAlleleFrequency(counts) : 0
    })
    jexl.addFunction('missingness', (feature: Feature) => {
      const counts = featureAlleleCounts(feature)
      return counts ? calculateMissingnessFrequency(counts) : 0
    })

    // Variant-consequence helpers, reading SnpEff ANN / VEP CSQ. `impact` and
    // `consequence` return strings for custom color-by-attribute expressions
    // (e.g. jexl:randomColor(consequence(feature))); `impactColor` powers the
    // one-click "Color by consequence impact" menu item.
    jexl.addFunction('impact', getVariantImpact)
    jexl.addFunction('consequence', getVariantConsequence)
    jexl.addFunction('impactColor', getVariantImpactColor)
    // `svTypeColor` powers the one-click "Color by SV type" menu item on the
    // single-variant display (fixed class colors + copy-number rainbow).
    jexl.addFunction('svTypeColor', getVariantSvTypeColor)
  }
}

export { default as VcfFeature } from './VcfFeature/index.ts'

export type { LinearVariantDisplayModel } from './LinearVariantDisplay/model.ts'
