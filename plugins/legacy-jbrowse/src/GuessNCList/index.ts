import { getFileName } from '@jbrowse/core/util/tracks'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { FileLocation } from '@jbrowse/core/util/types'

export default function GuessNCListF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-guessAdapterForLocation',
    adapterGuesser => {
      return (
        file: FileLocation,
        index?: FileLocation,
        adapterHint?: string,
      ) => {
        const fileName = getFileName(file)
        return (/trackData.jsonz?$/i.test(fileName) && !adapterHint) ||
          adapterHint === 'NCListAdapter'
          ? {
              type: 'NCListAdapter',
              rootUrlTemplate: file,
            }
          : adapterGuesser(file, index, adapterHint)
      }
    },
  )
}
