import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import { configSchemaFactory } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function DotplotDisplayF(pm: PluginManager) {
  pm.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'DotplotDisplay',
      displayName: 'Dotplot display',
      configSchema,
      // lazily loaded: fetched when a synteny track is shown in a dotplot or a
      // session names this display
      stateModel: () =>
        import('./stateModelFactory.tsx').then(f =>
          f.stateModelFactory(configSchema),
        ),
      trackType: 'SyntenyTrack',
      viewType: 'DotplotView',
      ReactComponent: () => null,
    })
  })
}
