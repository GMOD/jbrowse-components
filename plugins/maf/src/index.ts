import Plugin from '@jbrowse/core/Plugin'

import BgzipTaffyAdapterF from './BgzipTaffyAdapter/index.ts'
import BigMafAdapterF from './BigMafAdapter/index.ts'
import LinearMafDisplayF from './LinearMafDisplay/index.ts'
import LinearMafGetAlignmentDataF from './LinearMafGetAlignmentData/index.ts'
import MafAddTrackWorkflowF from './MafAddTrackWorkflow/index.ts'
import MafGetSequencesF from './MafGetSequences/index.ts'
import MafSequenceWidgetF from './MafSequenceWidget/index.ts'
import MafTabixAdapterF from './MafTabixAdapter/index.ts'
import MafTrackF from './MafTrack/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class MafViewerPlugin extends Plugin {
  name = 'MafViewerPlugin'

  install(pluginManager: PluginManager) {
    BgzipTaffyAdapterF(pluginManager)
    BigMafAdapterF(pluginManager)
    MafTrackF(pluginManager)
    LinearMafDisplayF(pluginManager)
    LinearMafGetAlignmentDataF(pluginManager)
    MafTabixAdapterF(pluginManager)
    MafAddTrackWorkflowF(pluginManager)
    MafGetSequencesF(pluginManager)
    MafSequenceWidgetF(pluginManager)
  }
}
