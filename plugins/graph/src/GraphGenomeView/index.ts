import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GraphGenomeViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'GraphGenomeView',
      displayName: 'Graph genome view',
      stateModel: modelFactory(),
      ReactComponent: lazy(
        () => import('./components/GraphGenomeView.tsx'),
      ),
    })
  })
}
