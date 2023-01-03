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
      (feature: Feature, attributeName: string) => {
        return Math.log(feature.get(attributeName) + 1)
      },
    )
  }
}
