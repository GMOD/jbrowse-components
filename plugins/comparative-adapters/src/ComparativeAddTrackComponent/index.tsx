import { lazy } from 'react'

import { pairwiseTypes } from '../syntenyTypes'

import type PluginManager from '@jbrowse/core/PluginManager'

// lazies
const ComparativeAddTrackComponent = lazy(
  () => import('./ComparativeAddTrackComponent'),
)

export default function ComparativeAddTrackComponentF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint(
    'Core-addTrackComponent',
    // @ts-expect-error
    (comp, { model }: { trackAdapterType: string }) => {
      return pairwiseTypes.includes(model.trackAdapterType)
        ? ComparativeAddTrackComponent
        : comp
    },
  )
}
