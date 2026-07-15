import { lazy } from 'react'

import { mcscanTypes } from '../syntenyTypes.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// lazies
const MCScanAddTrackComponent = lazy(
  () => import('./MCScanAddTrackComponent.tsx'),
)

export default function MCScanAddTrackComponentF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-addTrackComponent',
    (
      comp: unknown,
      { model }: { model?: { trackAdapterType?: string } },
    ): unknown => {
      const t = model?.trackAdapterType
      return t !== undefined && mcscanTypes.includes(t)
        ? MCScanAddTrackComponent
        : comp
    },
  )
}
