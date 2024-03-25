import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import GCContentAdapterF from './GCContentAdapter'
import GCContentTrackF from './GCContentTrack'
import LinearGCContentDisplayF from './LinearGCContentDisplay'

export default class GCContentPlugin extends Plugin {
  name = 'GCContentPlugin'

  install(pluginManager: PluginManager) {
    GCContentAdapterF(pluginManager)
    GCContentTrackF(pluginManager)
    LinearGCContentDisplayF(pluginManager)
  }
}
