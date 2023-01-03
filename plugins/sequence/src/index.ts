import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'

import TwoBitAdapterF from './TwoBitAdapter'
import DivSequenceRendererF from './DivSequenceRenderer'
import BgzipFastaAdapterF from './BgzipFastaAdapter'
import ChromSizesAdapterF from './ChromSizesAdapter'
import IndexedFastaAdapterF from './IndexedFastaAdapter'
import SequenceSearchAdapterF from './SequenceSearchAdapter'
import ReferenceSequenceTrackF from './ReferenceSequenceTrack'
import LinearReferenceSequenceDisplayF from './LinearReferenceSequenceDisplay'
import createExtensionPoints from './createExtensionPoints'

export default class SequencePlugin extends Plugin {
  name = 'SequencePlugin'

  install(pluginManager: PluginManager) {
    DivSequenceRendererF(pluginManager)
    TwoBitAdapterF(pluginManager)
    BgzipFastaAdapterF(pluginManager)
    ChromSizesAdapterF(pluginManager)
    IndexedFastaAdapterF(pluginManager)
    SequenceSearchAdapterF(pluginManager)
    ReferenceSequenceTrackF(pluginManager)
    LinearReferenceSequenceDisplayF(pluginManager)
    createExtensionPoints(pluginManager)
  }
}
