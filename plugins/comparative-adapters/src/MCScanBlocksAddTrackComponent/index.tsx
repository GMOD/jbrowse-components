import { lazy } from 'react'

import { addAddTrackComponent } from '@jbrowse/core/util'
import { mcscanBlocksTypes } from '@jbrowse/synteny-core'

import type PluginManager from '@jbrowse/core/PluginManager'

// lazies
const MCScanBlocksAddTrackComponent = lazy(
  () => import('./MCScanBlocksAddTrackComponent.tsx'),
)

export default function MCScanBlocksAddTrackComponentF(
  pluginManager: PluginManager,
) {
  addAddTrackComponent(pluginManager, {
    adapterTypes: mcscanBlocksTypes,
    component: MCScanBlocksAddTrackComponent,
    ownsAssembly: true,
  })
}
