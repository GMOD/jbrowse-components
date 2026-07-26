import { lazy } from 'react'

import { addAddTrackComponent } from '@jbrowse/core/util'

import type PluginManager from '@jbrowse/core/PluginManager'

const GWASAddTrackComponent = lazy(() => import('./GWASAddTrackComponent.tsx'))

// #region register
export default function GWASAddTrackComponentF(pluginManager: PluginManager) {
  addAddTrackComponent(pluginManager, {
    adapterTypes: ['GWASAdapter'],
    component: GWASAddTrackComponent,
  })
}
// #endregion
