import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function DotplotViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'DotplotView',
      displayName: 'Dotplot view',
      // lazily loaded: the model chunk is fetched when a session names a
      // DotplotView or one is launched, keeping it out of the initial bundle
      stateModel: () =>
        import('./model.ts').then(f => f.default(pluginManager)),
      ReactComponent: lazy(() => import('./components/DotplotView.tsx')),
    })
  })
}
