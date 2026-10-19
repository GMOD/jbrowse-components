import path from 'node:path'
import { pathToFileURL } from 'node:url'

import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'

import { multiwayTables, registerComparativeAdapters } from './tables.ts'

function engine(capabilities: string[]) {
  class Adapters extends Plugin {
    name = 'Adapters'
    install(pluginManager: PluginManager) {
      registerComparativeAdapters(pluginManager)
    }
  }
  const pluginManager = new PluginManager([new Adapters()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  pluginManager
    .getAdapterType('MultiGenomePAFAdapter')
    .adapterCapabilities.push(...capabilities)
  return pluginManager
}

const SYRI = {
  adapterConfig: {
    type: 'MultiGenomePAFAdapter',
    pafLocation: {
      uri: pathToFileURL(path.resolve('test_data/syri/syri_pangenome.paf'))
        .href,
      locationType: 'UriLocation',
    },
  },
  anchor: {
    assemblyName: 'Col-0',
    regions: [{ refName: 'Chr1', start: 0, end: 30_427_671 }],
    width: 800,
  },
}

test('a source answering lane pairs on the anchor exports its lanes stacked by structure, as the display stacks them', async () => {
  const dense = await multiwayTables(engine([]), SYRI)
  const stacked = await multiwayTables(engine(['lanePairsOnAnchor']), SYRI)
  expect(dense.assemblyNames).toEqual([
    'Col-0',
    'Kyo',
    'Cvi',
    'Sha',
    'Eri',
    'Ler',
  ])
  expect(stacked.assemblyNames).toEqual([
    'Col-0',
    'Kyo',
    'Sha',
    'Eri',
    'Ler',
    'Cvi',
  ])
})
