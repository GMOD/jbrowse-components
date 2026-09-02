import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import { circularLaunchKeys } from './launchKeys.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { ViewTypeRegistry } from '@jbrowse/core/PluginManager'

export default function CircularViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    // annotated against the registry rather than inferred, which is what
    // makes a hand-written augmentation earn what `getViewType` promises
    // its callers — see `ViewTypeRegistry`
    const stateModel = (): Promise<ViewTypeRegistry['CircularView']> =>
      import('./model.ts').then(f => f.default(pluginManager))
    return new ViewType({
      ReactComponent: lazy(() => import('./components/CircularView.tsx')),
      stateModel,
      launchKeys: circularLaunchKeys,
      name: 'CircularView',
      displayName: 'Circular view',
    })
  })
}
