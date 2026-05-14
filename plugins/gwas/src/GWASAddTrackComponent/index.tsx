import { lazy } from 'react'

import type PluginManager from '@jbrowse/core/PluginManager'

const GWASAddTrackComponent = lazy(() => import('./GWASAddTrackComponent.tsx'))

export default function GWASAddTrackComponentF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-addTrackComponent',
    (
      comp: unknown,
      arg: { model?: { trackAdapterType?: string } },
    ): unknown => {
      return arg.model?.trackAdapterType === 'GWASAdapter'
        ? GWASAddTrackComponent
        : comp
    },
  )
}
