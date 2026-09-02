import { lazy } from 'react'

import { DisplayType } from '@jbrowse/core/pluggableElementTypes'

import { configSchema } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

const SequenceDisplayComponent = lazy(
  () => import('./components/SequenceDisplayComponent.tsx'),
)

export default function LinearReferenceSequenceDisplayF(
  pluginManager: PluginManager,
) {
  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'LinearReferenceSequenceDisplay',
        configSchema,
        // lazily loaded: fetched when a reference sequence track is shown or a
        // session names this display
        stateModel: () =>
          import('./model.ts').then(f => f.modelFactory(configSchema)),
        displayName: 'Reference sequence display',
        trackType: 'ReferenceSequenceTrack',
        viewType: 'LinearGenomeView',
        ReactComponent: SequenceDisplayComponent,
      }),
  )
}
