import { addAdapterGuesser, testAdapter } from '@jbrowse/core/util'
import { getFileName, guessTabixIndex } from '@jbrowse/core/util/tracks'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GuessGff3F(pluginManager: PluginManager) {
  addAdapterGuesser(pluginManager, (file, index, adapterHint) => {
    const fileName = getFileName(file)
    if (
      testAdapter(fileName, /\.gff3?\.b?gz$/i, adapterHint, 'Gff3TabixAdapter')
    ) {
      return {
        type: 'Gff3TabixAdapter',
        gffGzLocation: file,
        index: guessTabixIndex(file, index),
      }
    } else if (testAdapter(fileName, /\.gff3?$/i, adapterHint, 'Gff3Adapter')) {
      return {
        type: 'Gff3Adapter',
        gffLocation: file,
      }
    } else {
      return undefined
    }
  })
}
