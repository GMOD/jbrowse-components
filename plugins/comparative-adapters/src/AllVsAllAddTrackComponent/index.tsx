import { lazy } from 'react'

import { allVsAllTypes } from '../syntenyTypes.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// lazies
const AllVsAllAddTrackComponent = lazy(
  () => import('./AllVsAllAddTrackComponent.tsx'),
)

export default function AllVsAllAddTrackComponentF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint(
    'Core-addTrackComponent',
    (
      comp: unknown,
      { model }: { model?: { trackAdapterType?: string } },
    ): unknown => {
      const t = model?.trackAdapterType
      return t !== undefined && allVsAllTypes.includes(t)
        ? AllVsAllAddTrackComponent
        : comp
    },
  )
}
