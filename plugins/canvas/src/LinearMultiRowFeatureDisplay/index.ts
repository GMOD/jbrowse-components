import { lazy } from 'react'

import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'

import configSchemaFactory from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const LinearMultiRowFeatureDisplayComponent = lazy(
  () => import('./components/LinearMultiRowFeatureDisplayComponent.tsx'),
)

export default function register(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    const configSchema = configSchemaFactory()
    return new DisplayType({
      name: 'LinearMultiRowFeatureDisplay',
      displayName: 'Multi-row feature display (painting)',
      helpText:
        'Paints interval features as colored blocks on stacked rows, partitioned by a feature attribute — chromosome / ancestry painting.',
      configSchema,
      // lazily loaded: fetched when a track picks this display or a session
      // names it, keeping the painting model out of the initial bundle
      stateModel: () => import('./model.ts').then(f => f.default(configSchema)),
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: LinearMultiRowFeatureDisplayComponent,
    })
  })
}
