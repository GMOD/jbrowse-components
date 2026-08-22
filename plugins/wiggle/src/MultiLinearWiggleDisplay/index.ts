import { lazy } from 'react'

import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const MultiLinearWiggleDisplayComponent = lazy(
  () => import('./components/MultiWiggleComponent.tsx'),
)

export default function MultiLinearWiggleDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'MultiLinearWiggleDisplay',
        displayName: 'Multi-Wiggle display',
        configSchema,
        // lazily loaded: fetched when a multi-quantitative track is shown or a
        // session names this display
        stateModel: () =>
          import('./model.ts').then(f => f.default(configSchema)),
        trackType: 'MultiQuantitativeTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: MultiLinearWiggleDisplayComponent,
      }),
  )
}
