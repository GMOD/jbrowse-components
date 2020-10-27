import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import TrackType from '@jbrowse/core/pluggableElementTypes/TrackType'
import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { BlockBasedTrack } from '@jbrowse/plugin-linear-genome-view'
import HicRenderer, {
  configSchema as hicRendererConfigSchema,
  ReactComponent as HicRendererReactComponent,
} from './HicRenderer'
import HicAdapterFactory from './HicAdapter'

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

    pluginManager.addTrackType(() => {
      const configSchema = hicTrackConfigSchemaFactory(pluginManager)
      return new TrackType({
        name: 'HicTrack',
        compatibleView: 'LinearGenomeView',
        configSchema,
        stateModel: hicTrackModelFactory(configSchema),
        ReactComponent: BlockBasedTrack,
      })
    })
  }
}
