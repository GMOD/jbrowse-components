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
      displayName: 'Dotplot display',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'SyntenyTrack',
      viewType: 'DotplotView',
      ReactComponent,
    })
  })
}

/**
 * #config DotplotDisplay
 */
export function configSchemaFactory(pm: any) {
  return ConfigurationSchema(
    'DotplotDisplay',
    {
      /**
       * #slot
       */
      renderer: types.optional(pm.pluggableConfigSchemaType('renderer'), {
        type: 'DotplotRenderer',
      }),
    },
    {
      /**
       * #identifier
       */
      explicitIdentifier: 'displayId',
      explicitlyTyped: true,
    },
  )
}
