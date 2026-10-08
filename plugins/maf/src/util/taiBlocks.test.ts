import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import BgzipMafAdapter from '../BgzipMafAdapter/BgzipMafAdapter.ts'
import bgzipMafConfigSchema from '../BgzipMafAdapter/configSchema.ts'
import BgzipTaffyAdapter from '../BgzipTaffyAdapter/BgzipTaffyAdapter.ts'
import bgzipTaffyConfigSchema from '../BgzipTaffyAdapter/configSchema.ts'
import { MafRegionSink } from '../LinearMafGetAlignmentDataRpc/mafRegionSink.ts'
import MafFeature from '../MafFeature.ts'
import { featureBlocks } from './mafBlockSink.ts'
import { mafFeatureTable } from './mafFeatureTable.ts'

import type { MafAdapterBase } from './MafAdapterBase.ts'
import type { FeatureTable } from '@jbrowse/core/util/featureTable'

const local = (name: string) => ({
  localPath: require.resolve(`../../test_data/${name}`),
  locationType: 'LocalPathLocation',
})

const taffy = (name: string, extra = {}) =>
  new BgzipTaffyAdapter(
    bgzipTaffyConfigSchema.create({
      tafGzLocation: local(`${name}.taf.gz`),
      taiLocation: local(`${name}.taf.gz.tai`),
      ...extra,
    }),
  )

// `stanzas.maf.gz.tai` is written by hand: `taffy index` refuses a MAF whose
// reference row is on the `-` strand, which the fourth stanza is.
const maf = (samples: string[] = []) =>
  new BgzipMafAdapter(
    bgzipMafConfigSchema.create({
      mafGzLocation: local('stanzas.maf.gz'),
      taiLocation: local('stanzas.maf.gz.tai'),
      samples,
    }),
  )

const region = (refName: string, start: number, end: number) => ({
  refName,
  start,
  end,
  assemblyName: 'test',
})

function rows(table: FeatureTable) {
  return Array.from({ length: table.length }, (_, i) => {
    const row = table.row(i)
    return [row.id(), row.toJSON()]
  })
}

async function bothWays(
  adapter: MafAdapterBase,
  query: ReturnType<typeof region>,
  visible?: Set<string>,
) {
  const packedView = (sink: MafRegionSink) => ({
    packed: sink.packer.finishBlocks(),
    refSampleId: sink.refSampleId,
    discovered: [...sink.discovered],
  })
  const direct = new MafRegionSink(visible)
  await adapter.readBlocks(query, direct)
  const overFeatures = new MafRegionSink(visible)
  await featureBlocks(adapter.getFeatures(query), overFeatures)
  const features = await firstValueFrom(
    adapter.getFeatures(query).pipe(toArray()),
  )
  return {
    direct: packedView(direct),
    overFeatures: packedView(overFeatures),
    features,
    table: rows(await adapter.getFeatureTable(query)),
    featureTable: rows(
      await mafFeatureTable(adapter.getFeatures(query), query.refName),
    ),
  }
}

const nh = { nhLocation: local('celegans/ce10.7way.nh') }

const CASES: [
  string,
  () => MafAdapterBase,
  ReturnType<typeof region>,
  Set<string> | undefined,
  number,
][] = [
  [
    'TAF, a tree',
    () => taffy('celegans/chrI', nh),
    region('chrI', 3700, 50_000),
    undefined,
    100,
  ],
  [
    'TAF, discovered species',
    () => taffy('celegans/chrI'),
    region('chrI', 3700, 50_000),
    undefined,
    100,
  ],
  [
    'TAF, a subtree',
    () => taffy('celegans/chrI', nh),
    region('chrI', 10_000, 10_400),
    new Set(['ce10', 'cb4']),
    1,
  ],
  [
    'TAF, a minus-strand row',
    () => taffy('evolverMammals'),
    region('Anc0refChr0', 0, 4151),
    undefined,
    1,
  ],
  [
    'TAF, a second contig in the slice',
    () => taffy('twoContig'),
    region('ctgA', 0, 4),
    undefined,
    1,
  ],
  ['MAF, every stanza', () => maf(), region('chr1', 0, 5000), undefined, 4],
  ['MAF, a narrow query', () => maf(), region('chr1', 105, 110), undefined, 2],
  ['MAF, the next contig', () => maf(), region('chr2', 0, 6000), undefined, 1],
  [
    'MAF, a sample set and a subtree',
    () => maf(['hg38', 'mm10', '3', 'rn6']),
    region('chr1', 0, 5000),
    new Set(['mm10', '3']),
    4,
  ],
  [
    'MAF, a filtered-out reference',
    () => maf(['mm10']),
    region('chr1', 0, 5000),
    undefined,
    4,
  ],
]

describe('readBlocks packs what the MafFeatures pack, byte for byte', () => {
  test.each(CASES)('%s', async (_name, make, query, visible, minBlocks) => {
    const got = await bothWays(make(), query, visible)
    expect(got.features.length).toBeGreaterThanOrEqual(minBlocks)
    expect(got.features.every(f => f instanceof MafFeature)).toBe(true)
    expect(got.direct).toEqual(got.overFeatures)
    expect(got.table).toEqual(got.featureTable)
    expect(got.table.map(([id]) => id)).toEqual(got.features.map(f => f.id()))
  })
})

test('a MAF stanza keeps its record order, copy rows and bridges', async () => {
  const features = await firstValueFrom(
    maf()
      .getFeatures(region('chr1', 0, 5000))
      .pipe(toArray()),
  )
  const keys = (field: string) =>
    features.map(f => Object.keys(f.get(field) as object))
  expect(keys('alignments')).toEqual([
    ['hg38', 'panTro6', 'mm10'],
    ['hg38', 'mm10', 'mm10~2', 'panTro6'],
    ['3', '12', 'hg38', 'panTro6'],
    ['hg38', 'mm10', 'panTro6'],
  ])
  expect(keys('empties')).toEqual([['rn6'], ['rn6', 'rn6~2'], [], []])
  const flipped = features[3]!
  expect([flipped.get('start'), flipped.get('end')]).toEqual([112, 116])
  expect(flipped.get('seq')).toBe('GGTT')
  expect(flipped.get('refSampleId')).toBe('hg38')
})
