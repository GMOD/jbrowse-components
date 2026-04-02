import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import modelFactory from './model.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function TubeMapViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'TubeMapView',
      displayName: 'Tube map view',
      stateModel: modelFactory(),
      ReactComponent: lazy(() => import('./components/TubeMapView.tsx')),
    })
  })
}
