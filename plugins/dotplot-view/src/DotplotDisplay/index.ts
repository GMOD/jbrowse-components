import { lazy } from 'react'

import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import { stateModelFactory } from './stateModelFactory.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function DotplotDisplayF(pm: PluginManager) {
  pm.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'DotplotDisplay',
      displayName: 'Dotplot display',
      configSchema,
      stateModel: stateModelFactory(configSchema),
      trackType: 'SyntenyTrack',
      viewType: 'DotplotView',
      ReactComponent: lazy(() => import('./components/DotplotDisplay.tsx')),
    })
  })
}

/**
 * #config DotplotDisplay
 */
export function configSchemaFactory() {
  return ConfigurationSchema(
    'DotplotDisplay',
    {},
    {
      /**
       * #identifier
       */
      explicitIdentifier: 'displayId',
      explicitlyTyped: true,
    },
  )
}
