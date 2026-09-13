import { lazy } from 'react'

import { addAddTrackComponent } from '@jbrowse/core/util'
import { multiGenomePAFTypes } from '@jbrowse/synteny-core'

import type PluginManager from '@jbrowse/core/PluginManager'

// lazies
const MultiGenomeAddTrackComponent = lazy(
  () => import('./MultiGenomeAddTrackComponent.tsx'),
)

export default function MultiGenomeAddTrackComponentF(
  pluginManager: PluginManager,
) {
  addAddTrackComponent(pluginManager, {
    adapterTypes: multiGenomePAFTypes,
    component: MultiGenomeAddTrackComponent,
    ownsAssembly: true,
  })
}
