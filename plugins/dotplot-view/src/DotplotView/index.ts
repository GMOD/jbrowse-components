import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import { dotplotLaunchKeys } from './launchKeys.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { ViewTypeRegistry } from '@jbrowse/core/PluginManager'

export default function DotplotViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    // annotated against the registry rather than inferred, which is what
    // makes a hand-written augmentation earn what `getViewType` promises
    // its callers — see `ViewTypeRegistry`
    const stateModel = (): Promise<ViewTypeRegistry['DotplotView']> =>
      import('./model.ts').then(f => f.default(pluginManager))
    return new ViewType({
      name: 'DotplotView',
      displayName: 'Dotplot view',
      stateModel,
      launchKeys: dotplotLaunchKeys,
      ReactComponent: lazy(() => import('./components/DotplotView.tsx')),
    })
  })
}
