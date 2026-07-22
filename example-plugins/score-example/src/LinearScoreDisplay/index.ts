import { lazy } from 'react'

import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import { configSchema } from './configSchema.ts'
import { modelFactory } from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const ScoreDisplayComponent = lazy(
  () => import('./components/ScoreDisplayComponent.tsx'),
)

export default function LinearScoreDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LinearScoreDisplay',
      configSchema,
      stateModel: modelFactory(configSchema),
      displayName: 'Score display (example)',
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: ScoreDisplayComponent,
    })
  })
}
