import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import PluginManager from '@jbrowse/core/PluginManager'
import { ReactComponent } from '../LinearComparativeDisplay'
import configSchemaF from './configSchemaF'
import stateModelFactory from './stateModelFactory'

export default (pluginManager: PluginManager) => {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new DisplayType({
      name: 'LinearSyntenyDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'SyntenyTrack',
      viewType: 'LinearSyntenyView',
      ReactComponent,
    })
  })
}
