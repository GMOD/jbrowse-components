import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import { configSchemaFactory } from './configSchema.ts'
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
      ReactComponent: () => null,
    })
  })
}
