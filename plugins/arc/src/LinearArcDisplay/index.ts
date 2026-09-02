import { lazy } from 'react'

import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import { configSchemaFactory } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearArcDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearArcDisplay',
      displayName: 'Arc display',
      configSchema,
      // lazily loaded: fetched when a track picks this display or a session
      // names it
      stateModel: () =>
        import('./model.ts').then(f => f.stateModelFactory(configSchema)),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: lazy(() => import('./components/ReactComponent.tsx')),
    })
  })
}
