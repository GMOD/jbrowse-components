import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { firstValueFrom, of } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { MafRegionSink } from '../LinearMafGetAlignmentDataRpc/mafRegionSink.ts'
import MafFeature from '../MafFeature.ts'
import {
  featureView,
  legacyMafTabixFeatures,
} from '../util/legacyMafParse.fixture.ts'
import { featureBlocks } from '../util/mafBlockSink.ts'
import { mafFeatureTable } from '../util/mafFeatureTable.ts'
import MafTabixAdapter from './MafTabixAdapter.ts'
import MafTabixConfigSchema from './configSchema.ts'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { FeatureTable } from '@jbrowse/core/util/featureTable'

function bedOver(lines: string[]) {
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
  return {
    getFeatures: () => of(...features),
  } as unknown as BaseFeatureDataAdapter
}

function adapterOver(
  lines: string[],
  refAssemblyName = '',
  samples: string[] = [],
) {
  const bed = bedOver(lines)
  return new MafTabixAdapter(
    MafTabixConfigSchema.create({ refAssemblyName, samples }),
    () =>
      Promise.resolve({
        dataAdapter: bed,
        sessionIds: new Set<string>(),
      }),
  )
}

const region = { refName: 'chr1', start: 0, end: 1000, assemblyName: 'hg38' }

async function featuresBothWays(
  lines: string[],
  sampleIds?: string[],
  refAssemblyName = '',
) {
  const rebuilt = await firstValueFrom(
    adapterOver(lines, refAssemblyName, sampleIds)
      .getFeatures(region)
      .pipe(toArray()),
  )
  const legacy = await firstValueFrom(
    legacyMafTabixFeatures(
      bedOver(lines),
      region,
      { sampleIds },
      refAssemblyName,
    ).pipe(toArray()),
  )
  return { rebuilt, legacy }
}

async function packedBothWays(adapter: MafTabixAdapter, visible?: Set<string>) {
  const direct = new MafRegionSink(visible)
  await adapter.readBlocks(region, direct)
  const features = new MafRegionSink(visible)
  await featureBlocks(adapter.getFeatures(region), features)
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

async function tablesBothWays(adapter: MafTabixAdapter) {
  return {
    direct: rows(await adapter.getFeatureTable(region)),
    features: rows(
      await mafFeatureTable(adapter.getFeatures(region), region.refName),
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
  // a species twice: the second entry is a copy row
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
  // a truncated entry is not completed from the next, a colon stays in its
  // sequence, a name with no dot is its whole token
  [
    e('hg38.chr1', 114, '+', 'CCGG'),
    'mm10.chr9:100:6,panTro6.chr3:203343:6:-:273340:gaattc',
    'rn6.chr1:100:6:+:15072434:GA:TTC',
    'nodot:1:2:+:9:AC',
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
  const { direct, features } = await packedBothWays(
    adapterOver(LINES, '', ['hg38', 'mm10', '3', 'rn6']),
    new Set(['mm10', '3']),
  )
  expect(direct.packed.sampleIds).toEqual(['mm10', 'mm10~2', '3'])
  expect(direct).toEqual(features)
})

test('a filtered-out first entry still positions its block', async () => {
  const { direct, features } = await packedBothWays(
    adapterOver(LINES, '', ['mm10']),
  )
  expect(direct.packed.blockRefLength[0]).toBe(4)
  expect(direct).toEqual(features)
})

// mm10 and the dropped hg38 are byte-identical over this block, which is what
// a pangenome haplotype is to its reference over most short blocks.
test('a row identical to a filtered-out reference is not named the reference', async () => {
  const lines = [
    [e('hg38.chr1', 100, '+', 'ACGT'), e('mm10.chr9', 7, '+', 'ACGT')].join(
      ',',
    ),
  ]
  const narrowed = await packedBothWays(adapterOver(lines, '', ['mm10']))
  expect(narrowed.direct.refSampleId).toBeUndefined()
  expect(narrowed.direct).toEqual(narrowed.features)
  const listed = await packedBothWays(adapterOver(lines, '', ['hg38', 'mm10']))
  expect(listed.direct.refSampleId).toBe('hg38')
  expect(listed.direct).toEqual(listed.features)
})

test('refAssemblyName picks the reference row both ways', async () => {
  const { direct, features } = await packedBothWays(
    adapterOver(LINES, 'panTro6'),
  )
  expect(direct.refSampleId).toBe('panTro6')
  expect(direct).toEqual(features)
})

// A caller that passes no sample set (the mark display's `getFeatureTable`,
// the sequence widget) still gets the adapter's own: a dotted id keys as
// listed, not as the name heuristic would cut it.
test('every read resolves a dotted sample id against the adapter’s set', async () => {
  const ids = ['Homo_sapiens.GRCh38', 'Mus_musculus.GRCm39']
  const adapter = adapterOver(
    [
      [
        e('Homo_sapiens.GRCh38.chr1', 100, '+', 'ACGT'),
        e('Mus_musculus.GRCm39.chr2', 7, '+', 'ACGA'),
      ].join(','),
    ],
    'Homo_sapiens.GRCh38',
    ids,
  )
  const [feature] = await firstValueFrom(
    adapter.getFeatures(region).pipe(toArray()),
  )
  expect(Object.keys(feature!.get('alignments') as object)).toEqual(ids)
  const table = await adapter.getFeatureTable(region)
  expect(table.row(0).toJSON()).toEqual(feature!.toJSON())
})

test("the adapter's table answers the ids and JSON its MafFeatures do", async () => {
  const adapter = adapterOver(LINES)
  const { direct, features } = await tablesBothWays(adapter)
  expect(direct).toHaveLength(LINES.length)
  expect(direct).toEqual(features)
  const filtered = await tablesBothWays(adapterOver(LINES, '', ['mm10']))
  expect(filtered.direct).toEqual(filtered.features)
})

describe('getFeatures answers the MafFeatures the old parse did', () => {
  test.each([
    ['every species', undefined, ''],
    ['a sample set', ['hg38', 'mm10', '3', 'rn6'], ''],
    ['a filtered-out reference', ['mm10'], ''],
    ['refAssemblyName', undefined, 'panTro6'],
    ['an absent refAssemblyName', undefined, 'galGal6'],
  ] as const)('%s', async (_, sampleIds, refAssemblyName) => {
    const { rebuilt, legacy } = await featuresBothWays(
      LINES,
      sampleIds && [...sampleIds],
      refAssemblyName,
    )
    expect(rebuilt).toHaveLength(LINES.length)
    expect(rebuilt.every(f => f instanceof MafFeature)).toBe(true)
    expect(featureView(rebuilt)).toStrictEqual(featureView(legacy))
  })

  test('each entry keeps its own fields', async () => {
    const { rebuilt } = await featuresBothWays(LINES)
    const [first, twice, indexed, malformed, truncated] = rebuilt.map(
      f => f.get('alignments') as Record<string, unknown>,
    )
    expect(first!.panTro6).toStrictEqual({
      chr: 'chr3',
      srcStart: 40,
      seq: 'ACTT',
      strand: -1,
      srcSize: 5000,
    })
    expect(Object.keys(twice!)).toEqual(['hg38', 'mm10', 'mm10~2', 'panTro6'])
    expect(twice!.mm10).toMatchObject({ chr: 'chr9', srcStart: 15 })
    expect(twice!['mm10~2']).toMatchObject({ chr: 'chr2', srcStart: 99 })
    expect(Object.keys(indexed!)).toEqual(['3', '12', 'hg38', 'panTro6'])
    expect(Object.keys(malformed!)).toEqual(['hg38', 'panTro6', 'rn6'])
    expect(malformed!.panTro6).toMatchObject({ srcStart: 52, srcSize: NaN })
    expect(truncated!.mm10).toBeUndefined()
    expect(truncated!.panTro6).toMatchObject({ srcStart: 203343 })
    expect(truncated!.rn6).toMatchObject({ seq: 'GA:TTC' })
    expect(truncated!.nodot).toMatchObject({ seq: 'AC' })
  })

  test('the reference row is the named one, else the first entry', async () => {
    const seqs = async (sampleIds?: string[], ref = '') =>
      (await featuresBothWays(LINES, sampleIds, ref)).rebuilt.map(f =>
        f.get('seq'),
      )
    expect((await seqs())[0]).toBe('ACGT')
    expect((await seqs(undefined, 'panTro6'))[0]).toBe('ACTT')
    expect((await seqs(['mm10']))[0]).toBe('ACGT')
    expect((await seqs()).at(-1)).toBe('')
  })
})
