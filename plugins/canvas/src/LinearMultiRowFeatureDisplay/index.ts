import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import LinearMultiRowFeatureDisplayComponent from './components/LinearMultiRowFeatureDisplayComponent.tsx'
import configSchemaFactory from './configSchema.ts'
import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearMultiRowFeatureDisplay',
      displayName: 'Multi-row feature display (painting)',
      helpText:
        'Paints interval features as colored blocks on stacked rows, partitioned by a feature attribute — chromosome / ancestry painting.',
      configSchema,
      stateModel: modelFactory(configSchema),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LinearMultiRowFeatureDisplayComponent,
    })
  })
}
