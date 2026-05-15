import React from 'react'

import LinearMafRenderer from './LinearMafRenderer.ts'
import configSchema from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

// Stub component — block rendering is bypassed by the GPU backend
const NullComponent = () => React.createElement(React.Fragment, null)

export default function LinearMafRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new LinearMafRenderer({
        name: 'LinearMafRenderer',
        ReactComponent: NullComponent,
        configSchema,
        pluginManager,
      }),
  )
}
