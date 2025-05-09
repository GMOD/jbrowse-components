import { testAdapter } from '@jbrowse/core/util'
import { getFileName } from '@jbrowse/core/util/tracks'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AdapterGuesser } from '@jbrowse/core/util/tracks'
import type { FileLocation } from '@jbrowse/core/util/types'

export default function GuessAdapterF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-guessAdapterForLocation',
    (adapterGuesser: AdapterGuesser) => {
      return (
        file: FileLocation,
        index?: FileLocation,
        adapterHint?: string,
      ) => {
        const fileName = getFileName(file)

        return testAdapter(
          fileName,
          /\.gtf(\.gz)?$/i,
          adapterHint,
          'GtfAdapter',
        )
          ? {
              type: 'GtfAdapter',
              gtfLocation: file,
            }
          : adapterGuesser(file, index, adapterHint)
      }
    },
  )
}
