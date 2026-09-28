import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { of } from 'rxjs'

import { MafRegionSink } from '../LinearMafGetAlignmentDataRpc/mafRegionSink.ts'
import { featureBlocks } from '../util/mafBlockSink.ts'
import { mafFeatureTable } from '../util/mafFeatureTable.ts'
import BigMafAdapter from './BigMafAdapter.ts'
import BigMafConfigSchema from './configSchema.ts'

import type { MafAdapterOptions } from '../types.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { FeatureTable } from '@jbrowse/core/util/featureTable'

function adapterOver(stanzas: string[][]) {
  const features = stanzas.map(
    (lines, i) =>
      new SimpleFeature({
        uniqueId: `bb${i}`,
        refName: 'chr1',
        start: i * 10,
        end: i * 10 + 4,
        mafBlock: lines.join(';'),
      }),
  )
  return new BigMafAdapter(BigMafConfigSchema.create({}), () =>
    Promise.resolve({
      dataAdapter: {
        getFeatures: () => of(...features),
      } as unknown as BaseFeatureDataAdapter,
      sessionIds: new Set<string>(),
    }),
  )
}

const region = { refName: 'chr1', start: 0, end: 1000, assemblyName: 'hg38' }

const STANZAS = [
  [
    'a score=1',
    's hg38.chr1 100 4 + 5000 ACGT',
    's panTro6.chr3 40 4 - 900 ACTT',
    'i panTro6.chr3 C 0 I 12',
    'e mm10.chr9 7 30 + 800 I',
    'q panTro6.chr3 9999',
  ],
  // a species twice, its context dropped with the row it named
  [
    's hg38.chr1 104 4 + 5000 TTAG',
    's mm10.chr9 15 4 + 800 TCAG',
    'i mm10.chr9 N 0 C 0',
    's mm10.chr2 99 4 - 700 TCAA',
    'e rn6.chr1 1 2 + 90 C',
    'e rn6.chr4 5 6 - 90 M',
  ],
  // array-index species first, a truncated s line dropped
  [
    's hg38.chr1 108 4 + 5000 GGCC',
    's 12.chrX 1 4 + 50 GGCA',
    's 3.chrY 2 4 - 50 GGCT',
    's panTro6.chr3 48 4',
    'e 7.chrZ 1 1 + 10 T',
    'e mm10.chr9 3 3 + 800 C',
  ],
  ['a score=0'],
]

async function packedBothWays(
  adapter: BigMafAdapter,
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

test('the direct parse packs what the MafFeatures pack, byte for byte', async () => {
  const { direct, features } = await packedBothWays(adapterOver(STANZAS))
  expect(direct.packed.rowHasContext).toBeDefined()
  expect(direct.packed.emptySample.length).toBe(4)
  expect(direct).toEqual(features)
})

test('a sample set and a subtree filter pack alike both ways', async () => {
  const samples = ['mm10', '3', '7', 'rn6'].map(id => ({ id, label: id }))
  const { direct, features } = await packedBothWays(
    adapterOver(STANZAS),
    { samples },
    new Set(['mm10', '7']),
  )
  expect(direct.packed.blockRefLength[0]).toBe(4)
  expect(direct).toEqual(features)
})

test("the adapter's table answers the ids and JSON its MafFeatures do", async () => {
  const adapter = adapterOver(STANZAS)
  const direct = rows(await adapter.getFeatureTable(region))
  const features = rows(
    await mafFeatureTable(adapter.getFeatures(region), region.refName),
  )
  expect(direct).toHaveLength(STANZAS.length)
  expect(direct).toEqual(features)
})
