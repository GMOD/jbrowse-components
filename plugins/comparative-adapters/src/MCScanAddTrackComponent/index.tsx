import { lazy } from 'react'

import { addAddTrackComponent } from '@jbrowse/core/util'
import { mcscanTypes } from '@jbrowse/synteny-core'

import type PluginManager from '@jbrowse/core/PluginManager'

// lazies
const MCScanAddTrackComponent = lazy(
  () => import('./MCScanAddTrackComponent.tsx'),
)

export default function MCScanAddTrackComponentF(pluginManager: PluginManager) {
  addAddTrackComponent(pluginManager, {
    adapterTypes: mcscanTypes,
    component: MCScanAddTrackComponent,
    ownsAssembly: true,
  })
}
