import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { BaseLinearDisplayComponent } from '@jbrowse/plugin-linear-genome-view'
import configSchemaF from './configSchemaF'
import stateModelF from './model'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function LGVSyntenyDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    const stateModel = stateModelF(configSchema)
    return new DisplayType({
      name: 'LGVSyntenyDisplay',
      configSchema,
      stateModel,
      trackType: 'SyntenyTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: BaseLinearDisplayComponent,
    })
  })
}
