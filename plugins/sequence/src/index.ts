import Plugin from '@jbrowse/core/Plugin'

import BgzipFastaAdapterF from './BgzipFastaAdapter'
import ChromSizesAdapterF from './ChromSizesAdapter'
import DivSequenceRendererF from './DivSequenceRenderer'
import IndexedFastaAdapterF from './IndexedFastaAdapter'
import LinearReferenceSequenceDisplayF from './LinearReferenceSequenceDisplay'
import ReferenceSequenceTrackF from './ReferenceSequenceTrack'
import SequenceSearchAdapterF from './SequenceSearchAdapter'
import TwoBitAdapterF from './TwoBitAdapter'
import UnindexedFastaAdapterF from './UnindexedFastaAdapter'
import createExtensionPoints from './createExtensionPoints'
import type PluginManager from '@jbrowse/core/PluginManager'

export default class SequencePlugin extends Plugin {
  name = 'SequencePlugin'

  install(pluginManager: PluginManager) {
    DivSequenceRendererF(pluginManager)
    TwoBitAdapterF(pluginManager)
    BgzipFastaAdapterF(pluginManager)
    ChromSizesAdapterF(pluginManager)
    IndexedFastaAdapterF(pluginManager)
    UnindexedFastaAdapterF(pluginManager)
    SequenceSearchAdapterF(pluginManager)
    ReferenceSequenceTrackF(pluginManager)
    LinearReferenceSequenceDisplayF(pluginManager)
    createExtensionPoints(pluginManager)
  }
}
