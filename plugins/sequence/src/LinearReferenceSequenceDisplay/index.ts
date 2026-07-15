import { lazy } from 'react'

import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import { configSchema } from './configSchema.ts'
import { modelFactory } from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const SequenceDisplayComponent = lazy(
  () => import('./components/SequenceDisplayComponent.tsx'),
)

export default function LinearReferenceSequenceDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addDisplayType(() => {
    const stateModel = modelFactory(configSchema)
    return new DisplayType({
      name: 'LinearReferenceSequenceDisplay',
      configSchema,
      stateModel,
      displayName: 'Reference sequence display',
      trackType: 'ReferenceSequenceTrack',
      viewType: 'LinearGenomeView',
      ReactComponent: SequenceDisplayComponent,
    })
  })
}
