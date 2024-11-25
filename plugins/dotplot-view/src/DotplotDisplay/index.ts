import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { types } from 'mobx-state-tree'

// locals
import ReactComponent from './components/DotplotDisplay'
import { stateModelFactory } from './stateModelFactory'
import type PluginManager from '@jbrowse/core/PluginManager'

export default function DotplotDisplayF(pm: PluginManager) {
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
