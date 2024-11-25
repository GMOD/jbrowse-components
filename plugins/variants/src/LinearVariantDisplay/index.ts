import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import configSchemaF from './configSchema'
import stateModelFactory from './model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearVariantDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new DisplayType({
      name: 'LinearVariantDisplay',
      displayName: 'Variant display',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })
}
