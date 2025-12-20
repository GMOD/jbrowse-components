import Plugin from '@jbrowse/core/Plugin'

import ChordVariantDisplayF from './ChordVariantDisplay'
import LinearVariantDisplayF from './LinearVariantDisplay'
import MultiLinearVariantDisplayF from './MultiLinearVariantDisplay'
import LinearVariantMatrixDisplayF from './MultiLinearVariantMatrixDisplay'
import LinearVariantMatrixRendererF from './MultiLinearVariantMatrixRenderer'
import MultiVariantRendererF from './MultiLinearVariantRenderer'
import SplitVcfTabixAdapterF from './SplitVcfTabixAdapter'
import StructuralVariantChordRendererF from './StructuralVariantChordRenderer'
import VariantFeatureWidgetF from './VariantFeatureWidget'
import { MultiVariantClusterGenotypeMatrix } from './VariantRPC/MultiVariantClusterGenotypeMatrix'
import { MultiVariantGetGenotypeMatrix } from './VariantRPC/MultiVariantGetGenotypeMatrix'
import { MultiVariantGetSimplifiedFeatures } from './VariantRPC/MultiVariantGetSimplifiedFeatures'
import { MultiVariantGetSources } from './VariantRPC/MultiVariantGetSources'
import VariantTrackF from './VariantTrack'
import VcfAdapterF from './VcfAdapter'
import ExtensionPointsF from './VcfExtensionPoints'
import VcfTabixAdapterF from './VcfTabixAdapter'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class VariantsPlugin extends Plugin {
  name = 'VariantsPlugin'

  install(pluginManager: PluginManager) {
    VcfAdapterF(pluginManager)
    VcfTabixAdapterF(pluginManager)
    SplitVcfTabixAdapterF(pluginManager)
    VariantFeatureWidgetF(pluginManager)
    VariantTrackF(pluginManager)
    ExtensionPointsF(pluginManager)
    LinearVariantDisplayF(pluginManager)
    LinearVariantMatrixDisplayF(pluginManager)
    MultiLinearVariantDisplayF(pluginManager)
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

export { default as VcfFeature } from './VcfFeature'
