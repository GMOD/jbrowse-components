import {
  layerTables,
  runTransforms,
} from '@jbrowse/core/util/featureTransforms'
import {
  BedTabixAdapter,
  bedTabixConfigSchema as BedTabixConfigSchema,
} from '@jbrowse/plugin-bed'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import MafTabixAdapter from './MafTabixAdapter.ts'
import MafTabixConfigSchema from './configSchema.ts'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { FeatureTable } from '@jbrowse/core/util/featureTable'

const fixture = (name: string) =>
  require.resolve(`../../../../test_data/volvox/${name}`)

const adapter = new MafTabixAdapter(
  MafTabixConfigSchema.create({
    bedGzLocation: {
      localPath: fixture('volvox.maf.bed.gz'),
      locationType: 'LocalPathLocation',
    },
    index: {
      location: {
        localPath: fixture('volvox.maf.bed.gz.tbi'),
        locationType: 'LocalPathLocation',
      },
    },
    nhLocation: {
      localPath: fixture('volvox.maf.nh'),
      locationType: 'LocalPathLocation',
    },
  }),
  subConf =>
    Promise.resolve({
      dataAdapter: new BedTabixAdapter(
        BedTabixConfigSchema.create(subConf),
      ) as BaseFeatureDataAdapter,
      sessionIds: new Set<string>(),
    }),
)

test('a flatten over alignments answers one row per species on the reference span', async () => {
  const blocks = await firstValueFrom(
    adapter
      .getFeatures({
        refName: 'ctgA',
        start: 0,
        end: 200,
        assemblyName: 'volvox',
      })
      .pipe(toArray()),
  )
  expect(blocks).toHaveLength(2)
  const table = runTransforms(blocks, [
    { type: 'flatten', field: 'alignments', key: 'species' },
  ])
  const rows = tableFeatures(table)
  expect(rows).toHaveLength(20)
  const first = rows[0]!
  expect(first.get('species')).toBe('volvox')
  expect([first.get('start'), first.get('end')]).toEqual([0, 100])
  expect(first.get('chr')).toBe('ctgA')
  expect(first.get('srcStart')).toBe(0)
  expect(first.get('strand')).toBe(1)
  expect(first.get('seq')).toHaveLength(100)
  const sim = rows[1]!
  expect(sim.get('species')).toBe('simvolvox')
  expect([sim.get('start'), sim.get('end'), sim.get('chr')]).toEqual([
    0,
    100,
    'chrA',
  ])
  expect(sim.get('srcStart')).toBe(4700)
  expect(new Set(rows.map(r => r.get('species'))).size).toBe(10)
  expect(rows[10]!.id()).toBe(`${blocks[1]!.id()}#volvox`)
  const cells = tableFeatures(runTransforms(table, [{ type: 'cells' }]))
  const reference = cells.filter(c => c.get('species') === 'volvox')
  expect(rows_(reference)).toEqual([
    [0, 100, 'match'],
    [100, 200, 'match'],
  ])
  const simCells = cells.filter(c => c.get('species') === 'simvolvox')
  expect(simCells.every(c => c.get('start') >= 0 && c.get('end') <= 200)).toBe(
    true,
  )
  expect(simCells.some(c => c.get('state') === 'mismatch')).toBe(true)
})

test("the adapter's table answers the species cells its features do", async () => {
  const region = { refName: 'ctgA', start: 0, end: 200, assemblyName: 'volvox' }
  const request = {
    transform: [
      { type: 'flatten' as const, field: 'alignments', key: 'species' },
      { type: 'cells' as const },
    ],
    facet: { field: 'species' },
    layers: [{}],
  }
  const table = await adapter.getFeatureTable(region)
  const features = await adapter.getFeaturesArray(region)
  const packed = layerTables(table, request).layers[0]!
  const fromFeatures = layerTables(features, request).layers[0]!
  expect(packed.table.length).toBeGreaterThan(100)
  expect(packed.row).toEqual(fromFeatures.row)
  const view = (t: FeatureTable) =>
    tableFeatures(t).map(f => [f.id(), f.toJSON()])
  expect(view(packed.table)).toEqual(view(fromFeatures.table))
})

function rows_(features: readonly Feature[]) {
  return features.map(f => [f.get('start'), f.get('end'), f.get('state')])
}

function tableFeatures(table: FeatureTable) {
  return Array.from({ length: table.length }, (_, i) => table.row(i))
}
