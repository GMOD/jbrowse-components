import { lazy } from 'react'

import { addAddTrackComponent } from '@jbrowse/core/util'
import { pairwiseTypes } from '@jbrowse/synteny-core'

import type PluginManager from '@jbrowse/core/PluginManager'

// lazies
const ComparativeAddTrackComponent = lazy(
  () => import('./ComparativeAddTrackComponent.tsx'),
)

export default function ComparativeAddTrackComponentF(
  pluginManager: PluginManager,
) {
  addAddTrackComponent(pluginManager, {
    adapterTypes: pairwiseTypes,
    component: ComparativeAddTrackComponent,
    ownsAssembly: true,
  })
}
