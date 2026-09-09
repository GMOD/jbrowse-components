// #exampleFile shared | registers the display type; the model and the component both load lazily
import { lazy } from 'react'

import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import { configSchema } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const ScoreDisplayComponent = lazy(
  () => import('./components/ScoreDisplayComponent.tsx'),
)

// #region register
export default function LinearScoreDisplayF(pluginManager: PluginManager) {
  pluginManager.addDisplayType(() => {
    return new DisplayType({
      name: 'LinearScoreDisplay',
      configSchema,
      // a thunk, so the model and everything it names load when a track first
      // shows this display or a session names it, not at plugin install
      stateModel: () =>
        import('./model.ts').then(m => m.modelFactory(configSchema)),
      displayName: 'Score display (example)',
      trackType: 'FeatureTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: ScoreDisplayComponent,
    })
  })
}
// #endregion
