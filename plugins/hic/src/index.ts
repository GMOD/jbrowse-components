import Plugin from '@jbrowse/core/Plugin'
import { colord } from '@jbrowse/core/util/colord'

import GuessAdapterF from './GuessAdapter/index.ts'
import HicAdapterF from './HicAdapter/index.ts'
import HicRendererF from './HicRenderer/index.ts'
import HicTrackF from './HicTrack/index.ts'
import LinearHicDisplayF from './LinearHicDisplay/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { Colord } from '@jbrowse/core/util/colord'

export default class HicPlugin extends Plugin {
  name = 'HicPlugin'

  install(pluginManager: PluginManager) {
    HicAdapterF(pluginManager)
    HicRendererF(pluginManager)
    HicTrackF(pluginManager)
    LinearHicDisplayF(pluginManager)
    GuessAdapterF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    const { jexl } = pluginManager
    jexl.addFunction('alpha', (color: Colord, n: number) => color.alpha(n))
    jexl.addFunction('hsl', (color: Colord) => colord(color.toHsl()))
    jexl.addFunction('colorString', (color: Colord) => color.toHex())
    jexl.addFunction(
      'interpolate',
      (count: number, scale: (n: number) => string) => scale(count),
    )
  }
}
