import Plugin from '@jbrowse/core/Plugin'

// locals
import GCContentAdapterF from './GCContentAdapter'
import GCContentTrackF from './GCContentTrack'
import LinearGCContentDisplayF from './LinearGCContentDisplay'
import type PluginManager from '@jbrowse/core/PluginManager'

export default class GCContentPlugin extends Plugin {
  name = 'GCContentPlugin'

  install(pluginManager: PluginManager) {
    GCContentAdapterF(pluginManager)
    GCContentTrackF(pluginManager)
    LinearGCContentDisplayF(pluginManager)
  }
}
