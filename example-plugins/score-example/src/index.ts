import Plugin from '@jbrowse/core/Plugin'

import LinearScoreDisplayF from './LinearScoreDisplay/index.ts'
import ScoreRPCF from './ScoreRPC/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class ScoreExamplePlugin extends Plugin {
  name = 'ScoreExamplePlugin'

  install(pluginManager: PluginManager) {
    LinearScoreDisplayF(pluginManager)
    ScoreRPCF(pluginManager)
  }
}
