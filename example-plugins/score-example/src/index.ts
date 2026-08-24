// #exampleFile shared | the plugin class; installs the display and the feature panel
import Plugin from '@jbrowse/core/Plugin'

import ScoreFeaturePanelF from './ScoreFeaturePanel/index.tsx'
import { LinearScoreDisplay } from './scoreDisplay.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class ScoreExamplePlugin extends Plugin {
  name = 'ScoreExamplePlugin'

  install(pluginManager: PluginManager) {
    LinearScoreDisplay.install(pluginManager)
    ScoreFeaturePanelF(pluginManager)
  }
}
