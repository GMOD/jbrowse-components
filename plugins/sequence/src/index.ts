import Plugin from '@jbrowse/core/Plugin'

import BgzipFastaAdapterF from './BgzipFastaAdapter/index.ts'
import ChromSizesAdapterF from './ChromSizesAdapter/index.ts'
import CrisprGuideAdapterF from './CrisprGuideAdapter/index.ts'
import IndexedFastaAdapterF from './IndexedFastaAdapter/index.ts'
import LinearReferenceSequenceDisplayF from './LinearReferenceSequenceDisplay/index.ts'
import MotifListAdapterF from './MotifListAdapter/index.ts'
import ReferenceSequenceTrackF from './ReferenceSequenceTrack/index.ts'
import SequenceSearchAdapterF from './SequenceSearchAdapter/index.ts'
import TwoBitAdapterF from './TwoBitAdapter/index.ts'
import UnindexedFastaAdapterF from './UnindexedFastaAdapter/index.ts'
import createExtensionPoints from './createExtensionPoints.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class SequencePlugin extends Plugin {
  name = 'SequencePlugin'

  install(pluginManager: PluginManager) {
    TwoBitAdapterF(pluginManager)
    BgzipFastaAdapterF(pluginManager)
    ChromSizesAdapterF(pluginManager)
    IndexedFastaAdapterF(pluginManager)
    UnindexedFastaAdapterF(pluginManager)
    SequenceSearchAdapterF(pluginManager)
    CrisprGuideAdapterF(pluginManager)
    MotifListAdapterF(pluginManager)
    ReferenceSequenceTrackF(pluginManager)
    LinearReferenceSequenceDisplayF(pluginManager)
    createExtensionPoints(pluginManager)
  }
}
