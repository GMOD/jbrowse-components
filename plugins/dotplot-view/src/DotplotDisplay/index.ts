/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import { stateModelFactory } from './stateModelFactory'
import ReactComponent from './components/DotplotDisplay'

export default (pm: PluginManager) => {
  pm.addDisplayType(() => {
    const configSchema = configSchemaFactory(pm)
    return new DisplayType({
      name: 'DotplotDisplay',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'SyntenyTrack',
      viewType: 'DotplotView',
      ReactComponent,
    })
  })
}

export function configSchemaFactory(pm: any) {
  return ConfigurationSchema(
    'DotplotDisplay',
    {
      renderer: types.optional(pm.pluggableConfigSchemaType('renderer'), {
        type: 'DotplotRenderer',
      }),
    },
    { explicitIdentifier: 'displayId', explicitlyTyped: true },
  )
}
