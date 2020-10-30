import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import HicRenderer, {
  configSchema as hicRendererConfigSchema,
  ReactComponent as HicRendererReactComponent,
} from './HicRenderer'
import HicAdapterFactory from './HicAdapter'

import {
  configSchemaFactory as linearHicdisplayConfigSchemaFactory,
  modelFactory as linearHicdisplayModelFactory,
} from './LinearHicDisplay'

export default class HicPlugin extends Plugin {
  name = 'HicPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'HicAdapter',
          ...pluginManager.jbrequire(HicAdapterFactory),
        }),
    )
    pluginManager.addRendererType(
      () =>
        new HicRenderer({
          name: 'HicRenderer',
          ReactComponent: HicRendererReactComponent,
          configSchema: hicRendererConfigSchema,
        }),
    )

    pluginManager.addDisplayType(() => {
      const configSchema = linearHicdisplayConfigSchemaFactory(pluginManager)
      return new DisplayType({
        name: 'LinearHicDisplay',
        configSchema,
        stateModel: linearHicdisplayModelFactory(configSchema),
        trackType: 'FeatureTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: BaseLinearDisplayComponent,
      })
    })
  }
}
