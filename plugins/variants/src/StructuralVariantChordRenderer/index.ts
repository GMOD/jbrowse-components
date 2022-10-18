import ChordRendererType from '@jbrowse/core/pluggableElementTypes/renderers/CircularChordRendererType'
import PluginManager from '@jbrowse/core/PluginManager'
import configSchema from './configSchema'
import ReactComponent from './ReactComponent'

const ChordRendererConfigF = (pluginManager: PluginManager) => {
  return new ChordRendererType({
    name: 'StructuralVariantChordRenderer',
    ReactComponent,
    configSchema,
    pluginManager,
  })
}

export default ChordRendererConfigF
