import path from 'node:path'
import { pathToFileURL } from 'node:url'

import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'

import * as getFeatures from './MultiWaySyntenyDisplay/MultiWayGetFeatures.ts'
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
  const stacked = await multiwayTables(engine(['lanePairsOnAnchor']), SYRI)
  expect(stacked.assemblyNames).toEqual([
    'Col-0',
    'Kyo',
    'Sha',
    'Eri',
    'Ler',
    'Cvi',
  ])
})

test('a reference-anchored file not declaring lane pairs on the anchor fails the export naming the missing pair', async () => {
  await expect(multiwayTables(engine([]), SYRI)).rejects.toThrow(
    /no alignments between "Kyo" and "Cvi"/,
  )
})

test('a failed lane-pair fetch fails the export instead of reading as no alignments', async () => {
  const real = getFeatures.executeMultiWayFeatures
  const spy = jest
    .spyOn(getFeatures, 'executeMultiWayFeatures')
    .mockImplementation(async args => {
      if (args.opts?.targetAssemblyName !== undefined) {
        throw new Error('pair fetch failed')
      }
      return real(args)
    })
  try {
    await expect(
      multiwayTables(engine(['lanePairsOnAnchor']), SYRI),
    ).rejects.toThrow('pair fetch failed')
  } finally {
    spy.mockRestore()
  }
})
