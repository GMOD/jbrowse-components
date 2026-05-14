import Plugin from '@jbrowse/core/Plugin'

import BgzipTaffyAdapterF from './BgzipTaffyAdapter'
import BigMafAdapterF from './BigMafAdapter'
import LinearMafDisplayF from './LinearMafDisplay'
import LinearMafGetAlignmentDataF from './LinearMafGetAlignmentData'
import LinearMafRendererF from './LinearMafRenderer'
import MafAddTrackWorkflowF from './MafAddTrackWorkflow'
import MafGetSamplesF from './MafGetSamples'
import MafGetSequencesF from './MafGetSequences'
import MafSequenceWidgetF from './MafSequenceWidget'
import MafTabixAdapterF from './MafTabixAdapter'
import MafTrackF from './MafTrack'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class MafViewerPlugin extends Plugin {
  name = 'MafViewerPlugin'

  install(pluginManager: PluginManager) {
    BgzipTaffyAdapterF(pluginManager)
    BigMafAdapterF(pluginManager)
    MafTrackF(pluginManager)
    LinearMafDisplayF(pluginManager)
    LinearMafRendererF(pluginManager)
    LinearMafGetAlignmentDataF(pluginManager)
    MafTabixAdapterF(pluginManager)
    MafAddTrackWorkflowF(pluginManager)
    MafGetSequencesF(pluginManager)
    MafGetSamplesF(pluginManager)
    MafSequenceWidgetF(pluginManager)
  }

  configure(_pluginManager: PluginManager) {}
}
