import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaF from './configSchemaF.ts'
import stateModelF from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LGVSyntenyDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    const stateModel = stateModelF(configSchema)
    const linearAlignmentsDisplay = pluginManager.getDisplayType(
      'LinearAlignmentsDisplay',
    )
    if (!linearAlignmentsDisplay?.ReactComponent) {
      throw new Error(
        'LinearAlignmentsDisplay plugin must be registered before LGVSyntenyDisplay',
      )
    }
    const { ReactComponent } = linearAlignmentsDisplay
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
