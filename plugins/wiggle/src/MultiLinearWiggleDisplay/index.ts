import { lazy } from 'react'

import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import configSchema from './configSchema.ts'
import stateModelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const MultiLinearWiggleDisplayComponent = lazy(
  () => import('./components/MultiLinearWiggleDisplayComponent.tsx'),
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
        stateModel: stateModelFactory(configSchema),
        trackType: 'MultiQuantitativeTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: MultiLinearWiggleDisplayComponent,
      }),
  )
}
