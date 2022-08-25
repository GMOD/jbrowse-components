import VcfAdapterF from './VcfAdapter'
import VcfTabixAdapterF from './VcfTabixAdapter'
import ExtensionPointsF from './extensionPoints'
import VariantTrackF from './VariantTrack'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import ChordVariantDisplay from './ChordVariantDisplay'
import LinearVariantDisplayF from './LinearVariantDisplay'
import StructuralVariantChordRendererFactory from './StructuralVariantChordRenderer'
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

    pluginManager.addRendererType(() =>
      pluginManager.jbrequire(StructuralVariantChordRendererFactory),
    )

    pluginManager.addDisplayType(() =>
      pluginManager.jbrequire(ChordVariantDisplay),
    )
  }
}

export { default as VcfFeature } from './VcfTabixAdapter/VcfFeature'
