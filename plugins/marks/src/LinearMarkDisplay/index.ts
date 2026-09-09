import { lazy } from 'react'

import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import { configSchemaFactory } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const ReactComponent = lazy(
  () => import('./components/LinearMarkDisplayComponent.tsx'),
)

export default function LinearMarkDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearMarkDisplay',
      displayName: 'Marks',
      helpText:
        'Bars, points and spans drawn from an encoding declared in the track config',
      configSchema,
      stateModel: () =>
        import('./model.ts').then(f =>
          f.stateModelFactory(pluginManager, configSchema),
        ),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent,
    })
  })
}
