import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import LinearArcDisplayF from './LinearArcDisplay'
import LinearPairedArcDisplayF from './LinearPairedArcDisplay'
import ArcRendererF from './ArcRenderer'
import { Feature } from '@jbrowse/core/util'
import { set1 } from '@jbrowse/core/ui/colors'

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
        if (alt?.startsWith('<DEL')) {
          return set1[0]
        } else if (alt?.startsWith('<DUP')) {
          return set1[1]
        } else if (alt?.startsWith('<INV')) {
          return set1[2]
        } else if (alt?.startsWith('<TRA')) {
          return set1[3]
        } else if (alt?.startsWith('<CNV')) {
          return set1[4]
        } else {
          return set1[5]
        }
      },
    )
  }
}
