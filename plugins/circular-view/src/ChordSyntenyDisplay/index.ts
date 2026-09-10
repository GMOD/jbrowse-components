import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaF from './models/configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function ChordSyntenyDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaF(pluginManager)
    return new DisplayType({
      name: 'ChordSyntenyDisplay',
      displayName: 'Chord synteny display',
      configSchema,
      // lazily loaded: fetched when a synteny track is shown in a circular
      // view or a session names this display. Everything synteny-shaped this
      // display reads lives behind that import, so a product with no synteny
      // plugins pays for the schema above and nothing else
      stateModel: () =>
        import('./models/stateModelFactory.ts').then(f =>
          f.default(configSchema),
        ),
      trackType: 'SyntenyTrack',
      viewType: 'CircularView',
      ReactComponent: lazy(
        () => import('./components/ChordSyntenyDisplay.tsx'),
      ),
    })
  })
}
