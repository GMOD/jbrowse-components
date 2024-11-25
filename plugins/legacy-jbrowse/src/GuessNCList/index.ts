import { getFileName } from '@jbrowse/core/util/tracks'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AdapterGuesser } from '@jbrowse/core/util/tracks'
import type { FileLocation } from '@jbrowse/core/util/types'

export default function GuessNCListF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-guessAdapterForLocation',
    (adapterGuesser: AdapterGuesser) => {
      return (
        file: FileLocation,
        index?: FileLocation,
        adapterHint?: string,
      ) => {
        const regexGuess = /trackData.jsonz?$/i
        const adapterName = 'NCListAdapter'
        const fileName = getFileName(file)
        if (regexGuess.test(fileName) || adapterHint === adapterName) {
          return {
            type: adapterName,
            rootUrlTemplate: file,
          }
        }
        return adapterGuesser(file, index, adapterHint)
      }
    },
  )
}
