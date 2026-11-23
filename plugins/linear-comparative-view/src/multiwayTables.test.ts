import path from 'node:path'
import { pathToFileURL } from 'node:url'

import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { SimpleFeature } from '@jbrowse/core/util'
import { registerComparativeAdapters } from '@jbrowse/plugin-comparative-adapters/tables'

import * as getFeatures from './MultiWaySyntenyDisplay/MultiWayGetFeatures.ts'
import { multiwayTables } from './tables.ts'

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
      uri: pathToFileURL(path.resolve('test_data/syri/syri.paf')).href,
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
  // densest first would read Kyo, Cvi, Sha, Eri, Ler
  expect(stacked.lanes.assembly).toEqual([
    'Col-0',
    'Kyo',
    'Eri',
    'Ler',
    'Cvi',
    'Sha',
  ])
})

test('with genome lanes the anchor exports first whatever rows.sort says', async () => {
  const sorted = await multiwayTables(engine(['lanePairsOnAnchor']), {
    ...SYRI,
    display: { rows: { sort: ['Kyo', 'Col-0', 'Sha'] } },
  })
  expect(sorted.lanes.assembly.slice(0, 3)).toEqual(['Col-0', 'Kyo', 'Sha'])
})

test('copy lanes export as the display draws them, rows.kept lifting the floor by any spelling', async () => {
  const copies = await multiwayTables(engine([]), {
    ...SYRI,
    display: { rows: { field: 'refName', sort: ['{Kyo}Chr1', 'Col-0'] } },
  })
  expect(copies.lanes.assembly.slice(0, 2)).toEqual(['{Kyo}Chr1', 'Col-0'])
  const kept = await multiwayTables(engine([]), {
    ...SYRI,
    display: { rows: { field: 'refName', kept: ['{Ler}chr3', '{Ler}Chr1'] } },
    laneAssemblyOf: name =>
      name === 'Ler'
        ? {
            regions: [],
            canonical: refName => (refName === 'chr3' ? 'Chr3' : refName),
          }
        : undefined,
  })
  expect(kept.lanes.assembly).toEqual(['Col-0', '{Ler}Chr1', '{Ler}Chr3'])
})

test('a reference-anchored file not declaring lane pairs on the anchor fails the export naming the missing pair', async () => {
  await expect(multiwayTables(engine([]), SYRI)).rejects.toThrow(
    /no alignments between "Kyo" and "Cvi"/,
  )
})

test('the exported ribbon key names the repeat color only for a track holding an array record', async () => {
  const keyOf = async (array: boolean) => {
    const real = getFeatures.executeMultiWayFeatures
    const spy = jest
      .spyOn(getFeatures, 'executeMultiWayFeatures')
      .mockImplementation(async args => {
        const features = await real(args)
        return array && args.opts?.targetAssemblyName === undefined
          ? features.map((f, i) =>
              i === 0 ? new SimpleFeature({ ...f.toJSON(), type: 'array' }) : f,
            )
          : features
      })
    try {
      return (await multiwayTables(engine(['lanePairsOnAnchor']), SYRI)).legend
        .label
    } finally {
      spy.mockRestore()
    }
  }
  expect(await keyOf(true)).toContain('Repeat, copies not paired')
  expect(await keyOf(false)).not.toContain('Repeat, copies not paired')
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

test('a header that reads lanes against the anchor only when asked exports each lane against the anchor, fetching no lane pairs', async () => {
  const header = jest
    .spyOn(BaseFeatureDataAdapter.prototype, 'getHeader')
    .mockImplementation(async opts => ({
      anchorAssemblyName: 'Col-0',
      ...(opts !== undefined && 'readsLanesAgainstAnchor' in opts
        ? { lanesReadAgainstAnchor: opts.readsLanesAgainstAnchor }
        : {}),
    }))
  const real = getFeatures.executeMultiWayFeatures
  const fetches = jest
    .spyOn(getFeatures, 'executeMultiWayFeatures')
    .mockImplementation(args => real(args))
  try {
    const tables = await multiwayTables(
      engine(['lanePairsOnAnchor', 'headerLanes']),
      SYRI,
    )
    expect(tables.lanes.assembly[0]).toBe('Col-0')
    expect(tables.lanes.assembly.length).toBeGreaterThan(1)
    expect(
      fetches.mock.calls.map(([args]) => [
        args.opts?.targetAssemblyName,
        args.opts?.readsLanesAgainstAnchor,
      ]),
    ).toEqual(fetches.mock.calls.map(() => [undefined, true]))
  } finally {
    header.mockRestore()
    fetches.mockRestore()
  }
})
