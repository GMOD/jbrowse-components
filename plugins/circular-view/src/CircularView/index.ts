import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function CircularViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(
    () =>
      new ViewType({
        ReactComponent: lazy(() => import('./components/CircularView.tsx')),
        stateModel: () =>
          import('./model.ts').then(f => f.default(pluginManager)),
        name: 'CircularView',
        displayName: 'Circular view',
      }),
  )
}
