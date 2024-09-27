import React from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'
import { linearSyntenyViewHelperModelFactory } from './stateModelFactory'

function UnusedComponent() {
  return <div />
}

export default function LinearSyntenyViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'LinearSyntenyViewHelper',
      displayName: 'Linear synteny view (helper)',
      viewMetadata: {
        hiddenFromGUI: true,
      },
      stateModel: linearSyntenyViewHelperModelFactory(pluginManager),
      ReactComponent: UnusedComponent,
    })
  })
}
