import PluginManager from '@jbrowse/core/PluginManager'
import { LinearVariantDisplayConfigFactory } from './configSchema'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import stateModelFactory from './model'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = LinearVariantDisplayConfigFactory(pluginManager)
    return new DisplayType({
      name: 'LinearVariantDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })
}
