import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { of } from 'rxjs'

import { MafRegionSink } from '../LinearMafGetAlignmentDataRpc/mafRegionSink.ts'
import { featureBlocks } from '../util/mafBlockSink.ts'
import { mafFeatureTable } from '../util/mafFeatureTable.ts'
import MafTabixAdapter from './MafTabixAdapter.ts'
import MafTabixConfigSchema from './configSchema.ts'

import type { MafAdapterOptions } from '../types.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { FeatureTable } from '@jbrowse/core/util/featureTable'

function adapterOver(lines: string[], refAssemblyName = '') {
  const features = lines.map(
    (field5, i) =>
      new SimpleFeature({
        uniqueId: `line${i}`,
        refName: 'chr1',
        start: i * 10,
        end: i * 10 + 4,
        field5,
      }),
  )
  return new MafTabixAdapter(
    MafTabixConfigSchema.create({ refAssemblyName }),
    () =>
      Promise.resolve({
        dataAdapter: {
          getFeatures: () => of(...features),
        } as unknown as BaseFeatureDataAdapter,
        sessionIds: new Set<string>(),
      }),
  )
}

const region = { refName: 'chr1', start: 0, end: 1000, assemblyName: 'hg38' }

async function packedBothWays(
  adapter: MafTabixAdapter,
  opts?: MafAdapterOptions,
  visible?: Set<string>,
) {
  const direct = new MafRegionSink(visible)
  await adapter.readBlocks(region, direct, opts)
  const features = new MafRegionSink(visible)
  await featureBlocks(adapter.getFeatures(region, opts), features)
  const view = (sink: MafRegionSink) => ({
    packed: sink.packer.finishBlocks(),
    refSampleId: sink.refSampleId,
    discovered: [...sink.discovered],
  })
  return { direct: view(direct), features: view(features) }
}

function rows(table: FeatureTable) {
  return Array.from({ length: table.length }, (_, i) => {
    const row = table.row(i)
    return [row.id(), row.toJSON()]
  })
}

async function tablesBothWays(
  adapter: MafTabixAdapter,
  opts?: MafAdapterOptions,
) {
  return {
    direct: rows(await adapter.getFeatureTable(region, opts)),
    features: rows(
      await mafFeatureTable(adapter.getFeatures(region, opts), region.refName),
    ),
  }
}

const e = (name: string, start: number, strand: string, seq: string) =>
  `${name}:${start}:${seq.replaceAll('-', '').length}:${strand}:5000:${seq}`

const LINES = [
  [
    e('hg38.chr1', 100, '+', 'ACGT'),
    e('panTro6.chr3', 40, '-', 'ACTT'),
    e('mm10.chr9', 7, '+', '--GT'),
  ].join(','),
  // a species twice: its first place, its last entry
  [
    e('hg38.chr1', 104, '+', 'TTAG'),
    e('mm10.chr9', 15, '+', 'TCAG'),
    e('mm10.chr2', 99, '-', 'TCAA'),
    e('panTro6.chr3', 44, '+', 'TTAG'),
  ].join(','),
  // array-index species come first, ascending, as record keys do
  [
    e('hg38.chr1', 108, '+', 'GGCC'),
    e('12.chrX', 1, '+', 'GGCA'),
    e('3.chrY', 2, '-', 'GGCT'),
    e('panTro6.chr3', 48, '+', 'GGCC'),
  ].join(','),
  // malformed entries are skipped, an absent srcSize is NaN
  [
    e('hg38.chr1', 112, '+', 'AAAA'),
    'broken',
    'mm10.chr9:1:2:+:5000:',
    'panTro6.chr3:+52:4:+::AAAT',
    `rn6.chr1:${'9'.repeat(18)}:4:+:5000:AATT`,
  ].join(','),
  // a non-ASCII row, long and short
  [
    e('hg38.chr1', 116, '+', 'ACéT'),
    e('mm10.chr9', 30, '+', 'Aé'.repeat(40)),
  ].join(','),
  // no reference at all
  '',
]

test('the direct parse packs what the MafFeatures pack, byte for byte', async () => {
  const { direct, features } = await packedBothWays(adapterOver(LINES))
  expect(direct.packed.rowOffset.length).toBeGreaterThan(10)
  expect(direct).toEqual(features)
  expect(direct.packed.sampleIds.slice(0, 3)).toEqual([
    'hg38',
    'panTro6',
    'mm10',
  ])
})

test('a subtree filter and a sample set pack alike both ways', async () => {
  const adapter = adapterOver(LINES)
  const samples = ['hg38', 'mm10', '3', 'rn6'].map(id => ({ id, label: id }))
  const { direct, features } = await packedBothWays(
    adapter,
    { samples },
    new Set(['mm10', '3']),
  )
  expect(direct.packed.sampleIds).toEqual(['mm10', '3'])
  expect(direct).toEqual(features)
})

test('a filtered-out first entry still positions its block', async () => {
  const adapter = adapterOver(LINES)
  const samples = [{ id: 'mm10', label: 'mm10' }]
  const { direct, features } = await packedBothWays(adapter, { samples })
  expect(direct.packed.blockRefLength[0]).toBe(4)
  expect(direct).toEqual(features)
})

test('refAssemblyName picks the reference row both ways', async () => {
  const { direct, features } = await packedBothWays(
    adapterOver(LINES, 'panTro6'),
  )
  expect(direct.refSampleId).toBe('panTro6')
  expect(direct).toEqual(features)
})

test("the adapter's table answers the ids and JSON its MafFeatures do", async () => {
  const adapter = adapterOver(LINES)
  const { direct, features } = await tablesBothWays(adapter)
  expect(direct).toHaveLength(LINES.length)
  expect(direct).toEqual(features)
  const samples = [{ id: 'mm10', label: 'mm10' }]
  const filtered = await tablesBothWays(adapter, { samples })
  expect(filtered.direct).toEqual(filtered.features)
})
