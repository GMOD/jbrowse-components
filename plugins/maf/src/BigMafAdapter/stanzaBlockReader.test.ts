import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom, of } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { MafRegionSink } from '../LinearMafGetAlignmentDataRpc/mafRegionSink.ts'
import MafFeature from '../MafFeature.ts'
import {
  featureView,
  legacyBigMafFeatures,
} from '../util/legacyMafParse.fixture.ts'
import { featureBlocks } from '../util/mafBlockSink.ts'
import { mafFeatureTable } from '../util/mafFeatureTable.ts'
import BigMafAdapter from './BigMafAdapter.ts'
import BigMafConfigSchema from './configSchema.ts'

import type {
  AlignmentRecord,
  EmptyRecord,
  MafAdapterOptions,
} from '../types.ts'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { FeatureTable } from '@jbrowse/core/util/featureTable'

function bigBedOver(stanzas: string[][]) {
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
  return {
    getFeatures: () => of(...features),
  } as unknown as BaseFeatureDataAdapter
}

function adapterOver(stanzas: string[][]) {
  const bigBed = bigBedOver(stanzas)
  return new BigMafAdapter(BigMafConfigSchema.create({}), () =>
    Promise.resolve({
      dataAdapter: bigBed,
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
  // a species twice, its context on the row it follows
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

const ALL_STANZAS = [
  ...STANZAS,
  // the UCSC spec's example: context on the row each i line names, leading
  // whitespace, a haplotype-suffixed genome
  [
    's hg18.chr7 27707221 13 + 158545518 gcagctgaaaaca',
    's panTro1.chr6 28869787 13 + 161576975 gcagctgaaaaca',
    'i panTro1.chr6 N 0 C 0',
    '  s baboon 249182 13 + 4622798 gcagctgaaaaca',
    'i baboon I 234 n 19',
    'e mm4.chr6 53310102 13 + 151104725 I',
    's HG002.1.chr7 200 13 + 900 gcagctgaaaaca',
  ],
  // an i line after every s line, for one row, and one for a species with no
  // row
  [
    's hg18.chr7 100 4 + 1000 ACGT',
    's panTro1.chr6 200 4 + 900 acgt',
    's baboon 300 4 + 800 acgt',
    'i panTro1.chr6 N 0 C 0',
    'i rheMac3.chr1 N 0 C 0',
  ],
]

async function featuresBothWays(stanzas: string[][], opts?: MafAdapterOptions) {
  const rebuilt = await firstValueFrom(
    adapterOver(stanzas).getFeatures(region, opts).pipe(toArray()),
  )
  const legacy = await firstValueFrom(
    legacyBigMafFeatures(bigBedOver(stanzas), region, opts).pipe(toArray()),
  )
  return { rebuilt, legacy }
}

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
  expect(direct.packed.emptySample.length).toBe(5)
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

const alignmentsOf = (f: Feature) =>
  f.get('alignments') as Record<string, AlignmentRecord>

describe('getFeatures answers the MafFeatures the old parse did', () => {
  test.each<[string, MafAdapterOptions | undefined]>([
    ['every species', undefined],
    [
      'a sample set',
      {
        samples: ['mm10', '3', '7', 'rn6', 'baboon'].map(id => ({
          id,
          label: id,
        })),
      },
    ],
    ['a set matching nothing', { samples: [{ id: 'galGal6', label: 'x' }] }],
  ])('%s', async (_, opts) => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const { rebuilt, legacy } = await featuresBothWays(ALL_STANZAS, opts)
    spy.mockRestore()
    expect(rebuilt).toHaveLength(ALL_STANZAS.length)
    expect(rebuilt.every(f => f instanceof MafFeature)).toBe(true)
    expect(featureView(rebuilt)).toStrictEqual(featureView(legacy))
    expect(JSON.stringify(rebuilt)).toBe(JSON.stringify(legacy))
  })

  test('each line lands on the row it names', async () => {
    const { rebuilt } = await featuresBothWays(ALL_STANZAS)
    const spec = rebuilt[4]!
    const rows = alignmentsOf(spec)
    expect(spec.get('seq')).toBe('gcagctgaaaaca')
    expect(rows.hg18).toStrictEqual({
      chr: 'chr7',
      srcStart: 27707221,
      seq: 'gcagctgaaaaca',
      strand: 1,
      srcSize: 158545518,
    })
    expect(rows.baboon!.context).toStrictEqual({
      leftStatus: 'I',
      leftCount: 234,
      rightStatus: 'n',
      rightCount: 19,
    })
    expect(rows.mm4).toBeUndefined()
    expect(
      (spec.get('empties') as Record<string, EmptyRecord>).mm4,
    ).toMatchObject({ status: 'I', size: 13 })
    expect(rows['HG002.1']).toMatchObject({ chr: 'chr7', srcStart: 200 })
    const late = alignmentsOf(rebuilt[5]!)
    expect(late.panTro1!.context).toMatchObject({ leftStatus: 'N' })
    expect(late.baboon!.context).toBeUndefined()
    expect(Object.keys(late)).toEqual(['hg18', 'panTro1', 'baboon'])
    const twice = alignmentsOf(rebuilt[1]!)
    expect(twice.mm10!.context).toMatchObject({ leftStatus: 'N' })
    expect(twice['mm10~2']).toMatchObject({ chr: 'chr2', srcStart: 99 })
    expect(twice['mm10~2']!.context).toBeUndefined()
  })
})
