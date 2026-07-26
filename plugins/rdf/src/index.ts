import Plugin from '@jbrowse/core/Plugin'
import { addAdapterGuesser } from '@jbrowse/core/util'
import { getFileName } from '@jbrowse/core/util/tracks'

import SPARQLAdapterF from './SPARQLAdapter/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'

export default class RdfPlugin extends Plugin {
  name = 'RdfPlugin'

  install(pluginManager: PluginManager) {
    SPARQLAdapterF(pluginManager)
    addAdapterGuesser(pluginManager, (file, _index, adapterHint) => {
      const fileName = getFileName(file)
      return /\/sparql$/i.test(fileName) || adapterHint === 'SPARQLAdapter'
        ? {
            type: 'SPARQLAdapter',
            endpoint: file,
          }
        : undefined
    })
  }
}
