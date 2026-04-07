import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaF from './configSchemaF.ts'
import stateModelF from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LGVSyntenyDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    const stateModel = stateModelF(configSchema)
    const { ReactComponent } = pluginManager.getDisplayType(
      'LinearAlignmentsDisplay',
    )
    return new DisplayType({
      name: 'LGVSyntenyDisplay',
      configSchema,
      stateModel,
      trackType: 'SyntenyTrack',
      viewType: 'LinearGenomeView',
      ReactComponent,
    })
  })
}
