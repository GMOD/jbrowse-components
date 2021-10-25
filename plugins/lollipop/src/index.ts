import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import {
  configSchemaFactory as linearLollipopDisplayConfigSchemaFactory,
  stateModelFactory as LinearLollipopDisplayStateModelFactory,
} from './LinearLollipopDisplay'
import LollipopRenderer, {
  configSchema as lollipopRendererConfigSchema,
  ReactComponent as LollipopRendererReactComponent,
} from './LollipopRenderer'

export default class extends Plugin {
  name = 'LollipopPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addRendererType(
      () =>
        new LollipopRenderer({
          name: 'LollipopRenderer',
          ReactComponent: LollipopRendererReactComponent,
          configSchema: lollipopRendererConfigSchema,
          pluginManager,
        }),
    )

    pluginManager.addDisplayType(() => {
      const configSchema =
        linearLollipopDisplayConfigSchemaFactory(pluginManager)
      return new DisplayType({
        name: 'LinearLollipopDisplay',
        configSchema,
        stateModel: LinearLollipopDisplayStateModelFactory(configSchema),
        trackType: 'LollipopTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      })
    })
  }
}
