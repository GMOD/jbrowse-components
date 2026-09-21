import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'

import VcfParser from '@gmod/vcf'
import PluginManager from '@jbrowse/core/PluginManager'
import SimpleFeature, {
  buildJexlContext,
} from '@jbrowse/core/util/simpleFeature'

import VcfFeature from '../VcfFeature/index.ts'
import VariantsPlugin from '../index.ts'
import {
  calculateAlleleCounts,
  calculateAlleleCountsFast,
} from './alleleCounts.ts'
import {
  calculateMinorAlleleFrequency,
  calculateMissingnessFrequency,
  getFilteredVariants,
  summarizeAlleleCounts,
} from './minorAlleleFrequencyUtils.ts'

import type { Feature } from '@jbrowse/core/util'

const pluginManager = new PluginManager([new VariantsPlugin()])
pluginManager.createPluggableElements()
pluginManager.configure()
const mafExpr = pluginManager.jexl.compile('maf(feature)')
const missingnessExpr = pluginManager.jexl.compile('missingness(feature)')

function genotypeRecordCounts(feature: Feature) {
  const genotypes = feature.get('genotypes') as
    | Record<string, string>
    | undefined
  return genotypes ? calculateAlleleCounts(genotypes) : undefined
}

function genotypeRecordMaf(feature: Feature) {
  const counts = genotypeRecordCounts(feature)
  return counts ? calculateMinorAlleleFrequency(counts) : 0
}

function genotypeRecordMissingness(feature: Feature) {
  const counts = genotypeRecordCounts(feature)
  return counts ? calculateMissingnessFrequency(counts) : 0
}

function differences(feature: Feature) {
  const context = buildJexlContext({ feature })
  const out: string[] = []
  const pairs = [
    ['maf', mafExpr.eval(context), genotypeRecordMaf(feature)],
    [
      'missingness',
      missingnessExpr.eval(context),
      genotypeRecordMissingness(feature),
    ],
  ] as const
  for (const [name, now, before] of pairs) {
    if (!Object.is(now, before)) {
      out.push(`${feature.id()} ${name}: ${now} vs ${before}`)
    }
  }
  return out
}

function makeParser(samples: string[]) {
  const cols = ['#CHROM', 'POS', 'ID', 'REF', 'ALT', 'QUAL', 'FILTER', 'INFO']
  return new VcfParser({
    header: [...cols, ...(samples.length ? ['FORMAT', ...samples] : [])].join(
      '\t',
    ),
  })
}

function vcfFeature(parser: VcfParser, line: string, id: string) {
  return new VcfFeature({ parser, variant: parser.parseLine(line), id })
}

const testData = path.resolve(__dirname, '../../../../test_data')

function vcfFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name)
    return e.isDirectory()
      ? vcfFiles(p)
      : /\.vcf(\.gz)?$/.test(e.name)
        ? [p]
        : []
  })
}

const MAX_RECORDS_PER_FILE = 2000

function loadSampled(file: string) {
  const buf = readFileSync(file)
  const text = (file.endsWith('.gz') ? gunzipSync(buf) : buf).toString()
  const lines = text.split('\n')
  const headerLines = lines.filter(l => l.startsWith('#'))
  const records = lines.filter(l => l && !l.startsWith('#'))
  const parser = new VcfParser({ header: headerLines.join('\n') })
  const stride = Math.max(1, Math.ceil(records.length / MAX_RECORDS_PER_FILE))
  const features: Feature[] = []
  for (let i = 0; i < records.length; i += stride) {
    features.push(vcfFeature(parser, records[i]!, `${file}:${i}`))
  }
  return { samples: parser.samples.length, features }
}

const files = vcfFiles(testData)
  .map(file => ({ file: path.relative(testData, file), ...loadSampled(file) }))
  .filter(f => f.samples > 0)

test('the test_data VCFs with samples include the 1000 Genomes slice', () => {
  const g1k = files.find(f => f.file.startsWith('1000g_snpeff_chr1'))
  expect(g1k?.samples).toBe(2504)
  expect(g1k?.features.length).toBe(1342)
})

test.each(files.map(f => [f.file, f] as const))(
  '%s: maf and missingness match the genotypes-record path',
  (_file, { features }) => {
    const diffs: string[] = []
    for (const feature of features) {
      expect(calculateAlleleCountsFast(feature as VcfFeature)).toEqual(
        genotypeRecordCounts(feature),
      )
      diffs.push(...differences(feature))
    }
    expect(diffs).toEqual([])
  },
)

describe('hand-written genotypes', () => {
  const samples = ['s0', 's1', 's2', 's3', 's4', 's5']
  const parser = makeParser(samples)
  const site = (format: string, gts: string[]) =>
    `chr1\t100\t.\tA\tC,G,T,AA,CC,GG,TT,AC,AG,AT,CA\t50\tPASS\t.\t${format}\t${gts.join('\t')}`

  const cases: [string, string][] = [
    ['phased', site('GT', ['0|1', '1|0', '1|1', '0|0', '0|1', '1|1'])],
    ['haploid', site('GT', ['0', '1', '1', '0', '.', '2'])],
    ['partial calls', site('GT', ['./1', '1/.', '.|0', '0|.', './.', '0/1'])],
    ['bare missing', site('GT', ['.', '.', '.', '0', '1', '.'])],
    ['all missing', site('GT', ['./.', '.', '.|.', './.', '.', '.'])],
    ['multi-allelic', site('GT', ['1/2', '2/3', '0/2', '3/3', '1/3', '0/0'])],
    ['alleles above 3', site('GT', ['0/4', '4/5', '7', '9|9', '4/4', '1/5'])],
    [
      'multi-digit alleles',
      site('GT', ['10/11', '3/12', '0/10', '11|11', '10', '1/1']),
    ],
    [
      'polyploid',
      site('GT', ['0/1/2', '1/1/1/1', './././.', '0|0|1', '4/4/4', '0/0']),
    ],
    [
      'GT among other fields',
      site('GT:DP:GQ', ['0/1:5:9', '1/1:3:2', './.:.:.', '0/0', '1', '']),
    ],
    [
      'GT not first',
      site('DP:GT', ['5:0/1', '3:1|1', '4:./.', '2:0/0', '9:1/2', '1:0']),
    ],
    [
      'empty GT from a truncated FORMAT',
      site('DP:AD:GT', ['5', '5:3,2', '', '4:1,1:0/1', '7:2', '6:3,3:1/1']),
    ],
    ['empty GT column', site('GT:DP', ['', '', '0/1:3', '', '1/1:4', ''])],
    ['no GT in FORMAT', site('DP:AD', ['5:3,2', '4:1,3', '', '', '', ''])],
    ['fewer columns than samples', site('GT', ['0/1', '1/1'])],
    ['odd tokens', site('GT', ['A/B', '0/1/', '/', '0//1', '|', '1'])],
    ['CRLF', `${site('GT', ['0/1', '1/1', '0/0', '0/0', './1', '1'])}\r`],
  ]

  test.each(cases)('%s', (name, line) => {
    const feature = vcfFeature(parser, line, name)
    expect(calculateAlleleCountsFast(feature)).toEqual(
      genotypeRecordCounts(feature),
    )
    expect(differences(feature)).toEqual([])
  })

  test('the empty GT is a no-call on both paths', () => {
    const feature = vcfFeature(
      parser,
      site('DP:GT', ['5', '3:0/1', '4', '2:1/1', '9', '1:0/0']),
      'truncated',
    )
    expect(calculateAlleleCountsFast(feature)).toEqual({
      '0': 3,
      '1': 3,
      '.': 3,
    })
    const context = buildJexlContext({ feature })
    expect(mafExpr.eval(context)).toBe(0.5)
    expect(missingnessExpr.eval(context)).toBe(1 / 3)
  })

  test('jexl reaches the scan through the feature proxy', () => {
    const feature = vcfFeature(
      parser,
      site('GT', ['0/1', '1/1', '0/0', '0/0', './1', '1']),
      'spied',
    )
    const get = jest.spyOn(feature, 'get')
    const scan = jest.spyOn(feature, 'processGenotypes')
    const context = buildJexlContext({ feature })
    mafExpr.eval(context)
    missingnessExpr.eval(context)
    expect(scan).toHaveBeenCalledTimes(2)
    expect(get).not.toHaveBeenCalledWith('genotypes')
  })

  test('a sites-only record reads 0 on both paths', () => {
    const sitesOnly = makeParser([])
    const feature = vcfFeature(
      sitesOnly,
      'chr1\t100\t.\tA\tC\t50\tPASS\t.',
      'x',
    )
    expect(differences(feature)).toEqual([])
    expect(mafExpr.eval(buildJexlContext({ feature }))).toBe(0)
  })

  test('a feature without processGenotypes keeps the genotypes-record path', () => {
    const withGenotypes = new SimpleFeature({
      uniqueId: 'simple',
      refName: 'chr1',
      start: 0,
      end: 1,
      genotypes: { a: '0/1', b: '1/1', c: './.', d: '' },
    })
    const without = new SimpleFeature({
      uniqueId: 'none',
      refName: 'chr1',
      start: 0,
      end: 1,
    })
    for (const feature of [withGenotypes, without]) {
      expect(differences(feature)).toEqual([])
    }
    expect(mafExpr.eval(buildJexlContext({ feature: withGenotypes }))).toBe(
      0.25,
    )
  })
})

// A genotypes Record is keyed by sample name, so a header repeating one keeps
// only its last column. The scan counts every column, as the display's own MAF
// filter always has; VCF 4.3 disallows duplicate sample IDs.
test('a duplicated sample ID counts every column, as getFilteredVariants does', () => {
  const parser = makeParser(['a', 'a', 'b'])
  const feature = vcfFeature(
    parser,
    'chr1\t100\t.\tA\tC\t50\tPASS\t.\tGT\t1/1\t0/0\t0/1',
    'dup',
  )
  const [variant] = getFilteredVariants({
    features: [feature],
    minorAlleleFrequencyFilter: 0,
  })
  expect(variant).toBeDefined()
  const display = summarizeAlleleCounts(calculateAlleleCountsFast(feature))
  const context = buildJexlContext({ feature })
  expect(mafExpr.eval(context)).toBe(display.minorAlleleFrequency)
  expect(mafExpr.eval(context)).toBe(0.5)
  expect(genotypeRecordMaf(feature)).toBe(0.25)
})
