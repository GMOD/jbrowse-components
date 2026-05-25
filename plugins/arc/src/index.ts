import Plugin from '@jbrowse/core/Plugin'
import { set1 } from '@jbrowse/core/ui/colors'

import ArcRendererF from './ArcRenderer/index.ts'
import LinearArcDisplayF from './LinearArcDisplay/index.ts'
import LinearPairedArcDisplayF from './LinearPairedArcDisplay/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

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
    const svTypeColors: [string, string][] = [
      ['<DEL', set1[0]!],
      ['<DUP', set1[1]!],
      ['<INV', set1[2]!],
      ['<TRA', set1[3]!],
      ['<CNV', set1[4]!],
    ]
    pluginManager.jexl.addFunction(
      'defaultPairedArcColor',
      (_feature: Feature, alt?: string) =>
        svTypeColors.find(([prefix]) => alt?.startsWith(prefix))?.[1] ??
        set1[6]!, // skip 5, yellow
    )
  }
}
