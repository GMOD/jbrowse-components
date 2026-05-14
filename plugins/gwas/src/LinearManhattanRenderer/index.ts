import ManhattanPlotRenderer from './LinearManhattanRenderer.ts'
import LinearManhattanRendering from './LinearManhattanRendering.tsx'
import { configSchema } from './configSchema.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function LinearManhattanRendererF(pluginManager: PluginManager) {
  pluginManager.addRendererType(
    () =>
      new ManhattanPlotRenderer({
        name: 'LinearManhattanRenderer',
        ReactComponent: LinearManhattanRendering,
        configSchema,
        pluginManager,
      }),
  )
}
