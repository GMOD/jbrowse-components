import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { FileLocation } from '@jbrowse/core/util/types'
import Color from 'color'
import HicRendererF from './HicRenderer'
import HicTrackF from './HicTrack'
import LinearHicDisplayF from './LinearHicDisplay'
import HicAdapterF from './HicAdapter'
import {
  AdapterGuesser,
  getFileName,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'

export default class HicPlugin extends Plugin {
  name = 'HicPlugin'

  install(pluginManager: PluginManager) {
    HicAdapterF(pluginManager)
    HicRendererF(pluginManager)
    HicTrackF(pluginManager)
    LinearHicDisplayF(pluginManager)

    pluginManager.addToExtensionPoint(
      'Core-guessAdapterForLocation',
      (adapterGuesser: AdapterGuesser) => {
        return (
          file: FileLocation,
          index?: FileLocation,
          adapterHint?: string,
        ) => {
          const regexGuess = /\.hic/i
          const adapterName = 'HicAdapter'
          const fileName = getFileName(file)
          const obj = {
            type: adapterName,
            hicLocation: file,
          }

          if (regexGuess.test(fileName) && !adapterHint) {
            return obj
          } else if (adapterHint === adapterName) {
            return obj
          }
          return adapterGuesser(file, index, adapterHint)
        }
      },
    )
    pluginManager.addToExtensionPoint(
      'Core-guessTrackTypeForLocation',
      (trackTypeGuesser: TrackTypeGuesser) => {
        return (adapterName: string) => {
          if (adapterName === 'HicAdapter') {
            return 'HicTrack'
          }
          return trackTypeGuesser(adapterName)
        }
      },
    )
  }

  configure(pluginManager: PluginManager) {
    pluginManager.jexl.addFunction('alpha', (color: Color, value: number) =>
      color.alpha(value),
    )
    pluginManager.jexl.addFunction('hsl', (color: Color) => color.hsl())
    pluginManager.jexl.addFunction('colorString', (color: Color) =>
      color.string(),
    )
  }
}
