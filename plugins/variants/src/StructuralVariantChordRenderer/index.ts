import ChordRendererType from '@jbrowse/core/pluggableElementTypes/renderers/CircularChordRendererType'
import PluginManager from '@jbrowse/core/PluginManager'
import configSchema from './configSchema'
import ReactComponent from './ReactComponent'

export default (pluginManager: PluginManager) => {
  pluginManager.addRendererType(
    () =>
      new ChordRendererType({
        ReactComponent,
        configSchema,
        displayName: 'SV chord renderer',
        name: 'StructuralVariantChordRenderer',
        pluginManager,
      }),
  )
}
