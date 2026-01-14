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
    // @ts-expect-error
    (comp, { model }: { trackAdapterType: string }) => {
      return mcscanTypes.includes(model.trackAdapterType)
        ? MCScanAddTrackComponent
        : comp
    },
  )
}
