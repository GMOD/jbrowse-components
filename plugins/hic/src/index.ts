import AdapterType from '@gmod/jbrowse-core/pluggableElementTypes/AdapterType'
import TrackType from '@gmod/jbrowse-core/pluggableElementTypes/TrackType'
import Plugin from '@gmod/jbrowse-core/Plugin'
import PluginManager from '@gmod/jbrowse-core/PluginManager'
import HicRenderer, {
  configSchema as hicRendererConfigSchema,
  ReactComponent as HicRendererReactComponent,
} from './HicRenderer'

import {
  configSchemaFactory as hicTrackConfigSchemaFactory,
  modelFactory as hicTrackModelFactory,
} from './HicTrack'

export default class HicPlugin extends Plugin {
  name = 'HicPlugin'

  install(pluginManager: PluginManager) {
    pluginManager.addAdapterType(
      () =>
        new AdapterType({
          name: 'HicAdapter',
          ...pluginManager.jbrequire(require('./HicAdapter')),
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

    pluginManager.addTrackType(() => {
      const configSchema = hicTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'HicTrack',
        compatibleView: 'LinearGenomeView',
        configSchema,
        stateModel: hicTrackModelFactory(configSchema),
      })
    })
  }
}
