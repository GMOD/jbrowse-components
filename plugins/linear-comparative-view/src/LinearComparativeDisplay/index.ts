import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaFactory from './configSchemaF.ts'
import stateModelFactory from './stateModelFactory.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearComparativeDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory(pluginManager)
    return new DisplayType({
      name: 'LinearComparativeDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'SyntenyTrack',
      viewType: 'LinearComparativeView',
      ReactComponent: () => {
        return null
      },
    })
  })
}
