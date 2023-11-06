import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import LinearArcDisplayF from './LinearArcDisplay'
import LinearPairedArcDisplayF from './LinearPairedArcDisplay'
import ArcRendererF from './ArcRenderer'
import { Feature } from '@jbrowse/core/util'

export default class ArcPlugin extends Plugin {
  name = 'ArcRenderer'
  install(pluginManager: PluginManager) {
    ArcRendererF(pluginManager)
    LinearArcDisplayF(pluginManager)
    LinearPairedArcDisplayF(pluginManager)

    pluginManager.jexl.addFunction(
      'logThickness',
      (feature: Feature, attributeName: string) =>
        Math.log(feature.get(attributeName) + 1),
    )
    pluginManager.jexl.addFunction(
      'defaultPairedArcColor',
      (_feature: Feature, alt: string) => {
        if (alt.startsWith('<DEL')) {
          return 'darkblue'
        } else if (alt.startsWith('<DUP')) {
          return 'darkgreen'
        } else if (alt.startsWith('<CNV')) {
          return 'darkblue'
        } else if (alt.startsWith('<INV')) {
          return 'green'
        } else {
          return 'green'
        }
      },
    )
  }
}
