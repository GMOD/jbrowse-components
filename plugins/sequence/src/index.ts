import Plugin from '@jbrowse/core/Plugin'

import CrisprGuideAdapterF from './CrisprGuideAdapter/index.ts'
import LinearReferenceSequenceDisplayF from './LinearReferenceSequenceDisplay/index.ts'
import MotifListAdapterF from './MotifListAdapter/index.ts'
import ReferenceSequenceTrackF from './ReferenceSequenceTrack/index.ts'
import SequenceSearchAdapterF from './SequenceSearchAdapter/index.ts'
import { registerSequenceAdapters } from './adapters.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class SequencePlugin extends Plugin {
  name = 'SequencePlugin'

  install(pluginManager: PluginManager) {
    registerSequenceAdapters(pluginManager)
    SequenceSearchAdapterF(pluginManager)
    CrisprGuideAdapterF(pluginManager)
    MotifListAdapterF(pluginManager)
    ReferenceSequenceTrackF(pluginManager)
    LinearReferenceSequenceDisplayF(pluginManager)
  }
}
