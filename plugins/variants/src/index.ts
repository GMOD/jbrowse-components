import Plugin from '@jbrowse/core/Plugin'

import ChordVariantDisplayF from './ChordVariantDisplay/index.ts'
import LDDisplayF from './LDDisplay/index.ts'
import LDRendererF from './LDRenderer/index.ts'
import LDTrackF from './LDTrack/index.ts'
import LinearVariantDisplayF from './LinearVariantDisplay/index.ts'
import MultiLinearVariantDisplayF from './MultiLinearVariantDisplay/index.ts'
import LinearVariantMatrixDisplayF from './MultiLinearVariantMatrixDisplay/index.ts'
import LinearVariantMatrixRendererF from './MultiLinearVariantMatrixRenderer/index.ts'
import MultiVariantRendererF from './MultiLinearVariantRenderer/index.ts'
import PlinkLDAdapterF from './PlinkLDAdapter/index.ts'
import SplitVcfTabixAdapterF from './SplitVcfTabixAdapter/index.ts'
import StructuralVariantChordRendererF from './StructuralVariantChordRenderer/index.ts'
import VariantFeatureWidgetF from './VariantFeatureWidget/index.ts'
import { MultiVariantClusterGenotypeMatrix } from './VariantRPC/MultiVariantClusterGenotypeMatrix.ts'
import { MultiVariantGetGenotypeMatrix } from './VariantRPC/MultiVariantGetGenotypeMatrix.ts'
import { MultiVariantGetSimplifiedFeatures } from './VariantRPC/MultiVariantGetSimplifiedFeatures.ts'
import { MultiVariantGetSources } from './VariantRPC/MultiVariantGetSources.ts'
import VariantTrackF from './VariantTrack/index.ts'
import VcfAdapterF from './VcfAdapter/index.ts'
import ExtensionPointsF from './VcfExtensionPoints/index.ts'
import VcfTabixAdapterF from './VcfTabixAdapter/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

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
    LinearVariantMatrixDisplayF(pluginManager)
    MultiLinearVariantDisplayF(pluginManager)
    LDDisplayF(pluginManager)
    LDRendererF(pluginManager)
    MultiVariantRendererF(pluginManager)
    LinearVariantMatrixRendererF(pluginManager)
    StructuralVariantChordRendererF(pluginManager)
    ChordVariantDisplayF(pluginManager)

    pluginManager.addRpcMethod(() => new MultiVariantGetSources(pluginManager))
    pluginManager.addRpcMethod(
      () => new MultiVariantGetGenotypeMatrix(pluginManager),
    )
    pluginManager.addRpcMethod(
      () => new MultiVariantClusterGenotypeMatrix(pluginManager),
    )
    pluginManager.addRpcMethod(
      () => new MultiVariantGetSimplifiedFeatures(pluginManager),
    )
  }
}

export { default as VcfFeature } from './VcfFeature/index.ts'
