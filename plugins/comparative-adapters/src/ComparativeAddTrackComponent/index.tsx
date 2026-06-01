import { lazy } from 'react'

import { pairwiseTypes } from '../syntenyTypes.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// lazies
const ComparativeAddTrackComponent = lazy(
  () => import('./ComparativeAddTrackComponent.tsx'),
)

export default function ComparativeAddTrackComponentF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint(
    'Core-addTrackComponent',
    (
      comp: unknown,
      { model }: { model?: { trackAdapterType?: string } },
    ): unknown => {
      const t = model?.trackAdapterType
      return t !== undefined && pairwiseTypes.includes(t)
        ? ComparativeAddTrackComponent
        : comp
    },
  )
}
