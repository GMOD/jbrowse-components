import Plugin from '@jbrowse/core/Plugin'
import { set1 } from '@jbrowse/core/ui/colors'

import ArcGetFeaturesRPCMethodsF from './ArcGetFeaturesRPC/index.ts'
import LinearArcDisplayF from './LinearArcDisplay/index.ts'
import LinearPairedArcDisplayF from './LinearPairedArcDisplay/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Feature } from '@jbrowse/core/util'

const svTypeColors: [string, string][] = [
  ['<DEL', set1[0]!],
  ['<DUP', set1[1]!],
  ['<INV', set1[2]!],
  ['<TRA', set1[3]!],
  ['<CNV', set1[4]!],
]

// The functions the arc config slots default to. Exported so the plugin's own
// test harness registers the same ones `install` does — a harness without them
// can only test slot values written by hand, which is how a default expression
// that blanked the display shipped.
export function addArcJexlFunctions(pluginManager: PluginManager) {
  /** #jexlFunction Slot defaults from plugins | logThickness(feature, 'score') | log(attribute + 1), the arc display's default thickness */
  pluginManager.jexl.addFunction(
    'logThickness',
    (feature: Feature, attributeName: string) => {
      // 0, not NaN, when the feature carries no such attribute: the display
      // reads no thickness signal as its fallback stroke, where NaN spread
      // through the arc's extent and culled it off screen
      const thickness = Math.log(Number(feature.get(attributeName)) + 1)
      return Number.isFinite(thickness) ? thickness : 0
    },
  )
  /** #jexlFunction Slot defaults from plugins | defaultPairedArcColor(feature, alt) | a color per SV type read off the ALT (DEL, DUP, INV, TRA, CNV) */
  pluginManager.jexl.addFunction(
    'defaultPairedArcColor',
    (_feature: Feature, alt?: string) =>
      svTypeColors.find(([prefix]) => alt?.startsWith(prefix))?.[1] ?? set1[6]!, // skip 5, yellow
  )
}

export default class ArcPlugin extends Plugin {
  name = 'ArcRenderer'
  install(pluginManager: PluginManager) {
    LinearArcDisplayF(pluginManager)
    LinearPairedArcDisplayF(pluginManager)
    ArcGetFeaturesRPCMethodsF(pluginManager)
    addArcJexlFunctions(pluginManager)
  }
}
