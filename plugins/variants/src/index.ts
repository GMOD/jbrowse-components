import VcfAdapterF from './VcfAdapter'
import VcfTabixAdapterF from './VcfTabixAdapter'
import ExtensionPointsF from './extensionPoints'
import VariantTrackF from './VariantTrack'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import ChordVariantDisplayF from './ChordVariantDisplay'
import LinearVariantDisplayF from './LinearVariantDisplay'
import StructuralVariantChordRendererF from './StructuralVariantChordRenderer'
import VariantFeatureWidgetF from './VariantFeatureWidget'

export default class VariantsPlugin extends Plugin {
  name = 'VariantsPlugin'

  install(pluginManager: PluginManager) {
    VcfAdapterF(pluginManager)
    VcfTabixAdapterF(pluginManager)
    VariantFeatureWidgetF(pluginManager)
    VariantTrackF(pluginManager)
    ExtensionPointsF(pluginManager)
    LinearVariantDisplayF(pluginManager)
    StructuralVariantChordRendererF(pluginManager)
    ChordVariantDisplayF(pluginManager)
  }
}

export { default as VcfFeature } from './VcfFeature'
