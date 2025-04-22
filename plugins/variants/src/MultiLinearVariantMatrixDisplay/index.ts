import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import MultiLinearVariantMatrixDisplayComponent from './components/VariantDisplayComponent'
import configSchemaF from './configSchema'
import stateModelFactory from './model'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearVariantMatrixDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new DisplayType({
      name: 'LinearVariantMatrixDisplay',
      displayName: 'Multi-sample variant display (matrix)',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: MultiLinearVariantMatrixDisplayComponent,
    })
  })
}
