import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import ReactComponent from './components/LinearMafDisplayComponent.tsx'
import configSchemaF from './configSchema.ts'
import stateModelFactory from './stateModel.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearMafDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    const stateModel = stateModelFactory(configSchema)
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
