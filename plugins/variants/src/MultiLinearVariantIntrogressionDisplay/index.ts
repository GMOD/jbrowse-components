import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import IntrogressionDisplayComponent from './components/IntrogressionDisplayComponent'
import configSchemaF from './configSchema'
import stateModelFactory from './model'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new DisplayType({
      name: 'MultiLinearVariantIntrogressionDisplay',
      displayName: 'Multi-sample introgression display',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'VariantTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: IntrogressionDisplayComponent,
    })
  })
}
