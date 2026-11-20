import VcfParser from '@gmod/vcf'
import PluginManager from '@jbrowse/core/PluginManager'
import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { SimpleFeature } from '@jbrowse/core/util'

import VcfFeature from '../VcfFeature/index.ts'
import VariantsPlugin from '../index.ts'
import { regionTransmission } from '../shared/regionTransmission.ts'
import { MENDELIAN_FIELD } from '../shared/trios.ts'
import { analyzeVariants } from './analyzeVariants.ts'
import { variantCellData } from './executeVariantCellData.ts'

import type { GetCellDataArgs } from './types.ts'

const TRIO = {
  child: 'kid',
  father: 'dad',
  mother: 'mom',
  sex: 'male' as const,
}

function featuresUnder(samples: string[], lines: string[], prefix: string) {
  const parser = new VcfParser({
    header: [
      '##fileformat=VCFv4.2',
      `#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\t${samples.join('\t')}`,
    ].join('\n'),
  })
  return lines.map(
    (line, i) =>
      new VcfFeature({
        parser,
        variant: parser.parseLine(line),
        id: `${prefix}${i}`,
      }),
  )
}

describe('split headers', () => {
  // Kid, dad and mom sit in a different order in each file, so reading the
  // second file's genotypes at the first file's positions would call its
  // record inconsistent: a kid's 1/1 from 0/1 x 0/0.
  const features = [
    ...featuresUnder(
      ['kid', 'dad', 'mom'],
      ['chr1\t100\t.\tA\tG\t.\t.\t.\tGT\t0/1\t0/0\t0/0'],
      'a',
    ),
    ...featuresUnder(
      ['mom', 'kid', 'dad'],
      ['chr2\t100\t.\tA\tG\t.\t.\t.\tGT\t1/1\t0/1\t0/0'],
      'b',
    ),
  ]

  test('each trio reads its columns through its own file’s header', () => {
    const { mendelian } = analyzeVariants({ features, trios: [TRIO] })

    expect(Object.fromEntries(mendelian)).toEqual({
      a0: 'notInParents',
      b0: 'consistent',
    })
  })
})

test('a remembered trio no call settles stays unsettled at the next site', () => {
  const features = featuresUnder(
    ['kid', 'dad', 'mom'],
    [
      'chr1\t100\t.\tA\tG\t.\t.\t.\tGT\t./1\t0/1\t0/0',
      'chr1\t200\t.\tA\tG\t.\t.\t.\tGT\t./1\t0/1\t0/0',
    ],
    'u',
  )
  const { mendelian } = analyzeVariants({ features, trios: [TRIO] })

  expect(Object.fromEntries(mendelian)).toEqual({})
})

test('a record read through its genotypes record, with no codes, has no Mendelian check', () => {
  const recordOnly = new SimpleFeature({
    uniqueId: 'r0',
    refName: 'chr1',
    start: 99,
    end: 100,
    ALT: ['G'],
    genotypes: { kid: '0/1', dad: '0/0', mom: '0/0' },
  })
  const result = analyzeVariants({ features: [recordOnly], trios: [TRIO] })

  expect(result.filteredVariants).toHaveLength(1)
  expect(result.mendelian.size).toBe(0)
  expect(
    analyzeVariants({
      features: [recordOnly],
      trios: [TRIO],
      mendelianFilter: [{ field: MENDELIAN_FIELD, valid: true }],
    }).filteredVariants,
  ).toHaveLength(0)
})

const hg38 = [
  { refName: 'chrX', sex: 'male' as const, from: 'mother' as const },
  { refName: 'chrY', sex: 'male' as const, from: 'father' as const },
]

const aliases: Record<string, string> = { 'NC_000023.11': 'chrX' }
const assembly = {
  getCanonicalRefName2: (refName: string) => aliases[refName] ?? refName,
}

// trio_x.vcf holds a male kid's X records under RefSeq's name, as the
// renamed region names it: x1 1/1 from 0/0 x 0/1, x2 0/1 from 0/0 x 0/0 and
// x3 a het 0/1 from 0/1 x 0/0.
function trioCellData(args: Partial<GetCellDataArgs>) {
  const pluginManager = new PluginManager([new VariantsPlugin()])
  pluginManager.createPluggableElements()
  pluginManager.configure()
  return variantCellData({
    pluginManager,
    args: {
      sessionId: 'mendelianCheck',
      adapterConfig: {
        type: 'VcfAdapter',
        vcfLocation: {
          localPath: require.resolve('../VcfAdapter/test_data/trio_x.vcf'),
          locationType: 'LocalPathLocation',
        },
      },
      regions: [
        {
          assemblyName: 'hg38',
          refName: 'NC_000023.11',
          start: 0,
          end: 1000,
        },
      ],
      sampleFilter: ['dad', 'kid', 'mom'],
      siteFilter: [],
      rowsField: 'sample',
      layout: 'genomic',
      trios: [TRIO],
      transmission: regionTransmission(hg38, [{ refName: 'chrX' }], assembly),
      ...args,
    },
  })
}

async function mendelianByName(args: Partial<GetCellDataArgs>) {
  const result = await trioCellData(args)
  return isRegionRefused(result)
    ? 'refused'
    : Object.fromEntries(
        Object.values(result.value.perRegionCellData)
          .flatMap(data => data.featureInfo)
          .map(info => [info.name, info.mendelian]),
      )
}

describe('the worker’s Mendelian check', () => {
  test('a renamed RefSeq X takes the rule the view’s chrX resolved to', async () => {
    expect(await mendelianByName({})).toEqual({
      x1: 'consistent',
      x2: 'notInParents',
      x3: 'consistent',
    })
  })

  test('with no rule the hemizygous call reads as an autosome’s', async () => {
    expect(await mendelianByName({ transmission: [] })).toEqual({
      x1: 'inconsistent',
      x2: 'notInParents',
      x3: 'consistent',
    })
  })

  test('hidden genotype rows still classify, and test no site field', async () => {
    expect(
      await mendelianByName({
        sampleFilter: [],
        siteFilter: [{ field: 'minorAlleleFrequency', gte: 0.99 }],
      }),
    ).toEqual({
      x1: 'consistent',
      x2: 'notInParents',
      x3: 'consistent',
    })
  })

  test('hidden genotype rows ship no sample’s genotype, ploidy or name', async () => {
    const result = await trioCellData({ sampleFilter: [] })
    const value = isRegionRefused(result) ? undefined : result.value
    const featureInfo = Object.values(value?.perRegionCellData ?? {}).flatMap(
      data => data.featureInfo,
    )

    expect(featureInfo.map(info => info.genotypeCodes.length)).toEqual([
      0, 0, 0,
    ])
    expect(value?.sampleNames).toEqual([])
    expect(value?.samplePloidy).toEqual({})
    expect(value?.hasPhasedOrHaploid).toBe(false)
  })

  test('a track with no trio ships no Mendelian field', async () => {
    const result = await trioCellData({ trios: [] })
    const featureInfo = isRegionRefused(result)
      ? []
      : Object.values(result.value.perRegionCellData).flatMap(
          data => data.featureInfo,
        )

    expect(featureInfo).toHaveLength(3)
    expect(featureInfo.filter(info => 'mendelian' in info)).toEqual([])
  })

  test('with no trios and no rows no genotype is read', async () => {
    const result = await trioCellData({ sampleFilter: [], trios: [] })

    expect(
      isRegionRefused(result) ? 'refused' : result.value.sampleNames,
    ).toEqual([])
  })

  test('a filter entry on the check keeps the sites it names', async () => {
    expect(
      await mendelianByName({
        mendelianFilter: [{ field: MENDELIAN_FIELD, equal: 'notInParents' }],
      }),
    ).toEqual({ x2: 'notInParents' })
  })

  test('the cells’ hue and the records band read the check', async () => {
    const result = await trioCellData({
      color: { field: MENDELIAN_FIELD },
      recordFields: {
        tooltip: MENDELIAN_FIELD,
        facet: MENDELIAN_FIELD,
        labelName: '',
        labelDescription: '',
      },
    })
    const data = isRegionRefused(result)
      ? undefined
      : Object.values(result.value.perRegionCellData)[0]

    expect(
      data?.featureInfo.map((info, i) => [
        info.name,
        data.colorValues[data.featureColorValues[i]! - 1],
        info.tooltip,
        info.groupKey,
      ]),
    ).toEqual([
      ['x1', 'consistent', 'consistent', 'consistent'],
      ['x2', 'notInParents', 'notInParents', 'notInParents'],
      ['x3', 'consistent', 'consistent', 'consistent'],
    ])
  })
})
