import Plugin from '@jbrowse/core/Plugin'

import GCContentAdapterF from './GCContentAdapter/index.ts'
import GCContentTrackF from './GCContentTrack/index.ts'
import LinearGCContentDisplayF from './LinearGCContentDisplay/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class GCContentPlugin extends Plugin {
  name = 'GCContentPlugin'

  install(pluginManager: PluginManager) {
    GCContentAdapterF(pluginManager)
    GCContentTrackF(pluginManager)
    LinearGCContentDisplayF(pluginManager)
  }
}
