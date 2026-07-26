import { addAdapterGuesser } from '@jbrowse/core/util'
import { getFileName } from '@jbrowse/core/util/tracks'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function GuessNCListF(pluginManager: PluginManager) {
  addAdapterGuesser(pluginManager, (file, _index, adapterHint) => {
    const fileName = getFileName(file)
    return (/trackData.jsonz?$/i.test(fileName) && !adapterHint) ||
      adapterHint === 'NCListAdapter'
      ? {
          type: 'NCListAdapter',
          rootUrlTemplate: file,
        }
      : undefined
  })
}
