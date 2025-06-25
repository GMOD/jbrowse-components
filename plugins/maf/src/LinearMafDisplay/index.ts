import PluginManager from '@jbrowse/core/PluginManager'
import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import ReactComponent from './components/LinearMafDisplayComponent'
import configSchemaF from './configSchema'
import stateModelFactory from './stateModel'

export default function LinearMafDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    const stateModel = stateModelFactory(configSchema, pluginManager)
    return new DisplayType({
      name: 'LinearMafDisplay',
      configSchema,
      stateModel,
      ReactComponent,
      viewType: 'LinearGenomeView',
      trackType: 'MafTrack',
      displayName: 'MAF display',
    })
  })
}
