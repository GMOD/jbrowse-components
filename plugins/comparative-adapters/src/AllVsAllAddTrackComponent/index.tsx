import { lazy } from 'react'

import { addAddTrackComponent } from '@jbrowse/core/util'
import { allVsAllTypes } from '@jbrowse/synteny-core'

import type PluginManager from '@jbrowse/core/PluginManager'

// lazies
const AllVsAllAddTrackComponent = lazy(
  () => import('./AllVsAllAddTrackComponent.tsx'),
)

export default function AllVsAllAddTrackComponentF(
  pluginManager: PluginManager,
) {
  addAddTrackComponent(pluginManager, {
    adapterTypes: allVsAllTypes,
    component: AllVsAllAddTrackComponent,
    ownsAssembly: true,
  })
}
