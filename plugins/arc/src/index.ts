import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import LinearArcDisplayF from './LinearArcDisplay'
import ArcRendererF from './ArcRenderer'
import { Feature } from '@jbrowse/core/util'

export default class ArcPlugin extends Plugin {
  name = 'ArcRenderer'
  install(pluginManager: PluginManager) {
    ArcRendererF(pluginManager)
    LinearArcDisplayF(pluginManager)

    pluginManager.jexl.addFunction(
      'logThickness',
      (f: Feature, attributeName: string) => Math.log(f.get(attributeName) + 1),
    )
  }
}
