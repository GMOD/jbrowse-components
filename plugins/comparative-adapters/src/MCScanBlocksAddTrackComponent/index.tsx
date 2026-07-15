import { lazy } from 'react'

import { mcscanBlocksTypes } from '../syntenyTypes.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// lazies
const MCScanBlocksAddTrackComponent = lazy(
  () => import('./MCScanBlocksAddTrackComponent.tsx'),
)

export default function MCScanBlocksAddTrackComponentF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint(
    'Core-addTrackComponent',
    (
      comp: unknown,
      { model }: { model?: { trackAdapterType?: string } },
    ): unknown => {
      const t = model?.trackAdapterType
      return t !== undefined && mcscanBlocksTypes.includes(t)
        ? MCScanBlocksAddTrackComponent
        : comp
    },
  )
}
