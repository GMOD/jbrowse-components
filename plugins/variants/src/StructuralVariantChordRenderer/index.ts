import ChordRendererType from '@jbrowse/core/pluggableElementTypes/renderers/CircularChordRendererType'
import ReactComponent from './ReactComponent'
import configSchema from './configSchema'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function StructuralVariantChordRendererF(
  pluginManager: PluginManager,
) {
  pluginManager.addRendererType(
    () =>
      new ChordRendererType({
        name: 'StructuralVariantChordRenderer',
        displayName: 'SV chord renderer',
        ReactComponent,
        configSchema,
        pluginManager,
      }),
  )
}
