import VcfParser from '@gmod/vcf'

import { computeVariantCells } from '../LinearVariantDisplay/components/computeVariantCells.ts'
import VcfFeature from '../VcfFeature/index.ts'
import { analyzeVariants } from './analyzeVariants.ts'

// A sites-only VCF, as ClinVar ships: no FORMAT and no sample columns.
const LINES = [
  'ctgA\t100\trs1\tA\tG\t.\t.\tCLNSIG=Benign',
  'ctgA\t200\tsv1\tN\t<DEL>\t.\t.\tSVTYPE=DEL;END=900',
]

function twoSamples(lines: string[]) {
  const parser = new VcfParser({
    header: '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tS1\tS2',
  })
  return lines.map(
    (line, i) =>
      new VcfFeature({ parser, variant: parser.parseLine(line), id: `f${i}` }),
  )
}

function sitesOnly() {
  const parser = new VcfParser({
    header: '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
  })
  return LINES.map(
    (line, i) =>
      new VcfFeature({ parser, variant: parser.parseLine(line), id: `f${i}` }),
  )
}

// Every site test reads called alleles, which a sample-less VCF has none of,
// so each of its sites failed it and the payload came back empty.
test('a sample-less VCF keeps its sites, with no cells', () => {
  const analyzed = analyzeVariants({
    features: sitesOnly(),
    keepSampleLessSites: true,
  })
  const cells = computeVariantCells({
    ...analyzed,
    sources: [],
    unit: 'sample',
    showReference: false,
  })
  expect(cells.featureInfo.map(i => [i.name, i.svType])).toEqual([
    ['rs1', ''],
    ['sv1', 'DEL'],
  ])
  expect([...cells.featurePositions]).toEqual([99, 100, 199, 900])
  expect(cells.numCells).toBe(0)
})

test('columns, which draw no records band, keep dropping them', () => {
  expect(analyzeVariants({ features: sitesOnly() }).filteredVariants).toEqual(
    [],
  )
})

// `genotypes.show` off asks for no sample: the worker reads the file as one
// with no samples, so a site no sample calls stays, as on a sites-only VCF.
test('reading no genotypes keeps a sampled VCF site no sample calls', () => {
  const features = twoSamples([
    'ctgA\t100\trs1\tA\tG\t.\t.\t.\tGT\t0/1\t0/0',
    'ctgA\t200\trs2\tC\tT\t.\t.\t.\tGT\t./.\t./.',
  ])
  const read = analyzeVariants({ features, keepSampleLessSites: true })
  expect(read.filteredVariants.map(v => v.feature.get('name'))).toEqual(['rs1'])
  const unread = analyzeVariants({
    features,
    keepSampleLessSites: true,
    readGenotypes: false,
  })
  expect(unread.filteredVariants.map(v => v.feature.get('name'))).toEqual([
    'rs1',
    'rs2',
  ])
  expect(unread.sampleNames).toEqual([])
})

const MAF_FLOOR = [{ field: 'minorAlleleFrequency', gte: 0.05 }]

// The site fields are genotype statistics, which a sites-only VCF has none of:
// a MAF floor once dropped every site before the walk could keep it.
test('a site filter keeps a sample-less VCF site', () => {
  const analyzed = analyzeVariants({
    features: sitesOnly(),
    siteFilter: MAF_FLOOR,
    keepSampleLessSites: true,
  })
  expect(analyzed.filteredVariants.map(v => v.feature.get('name'))).toEqual([
    'rs1',
    'sv1',
  ])
})

test('reading no genotypes tests no site filter', () => {
  const features = twoSamples([
    'ctgA\t100\trs1\tA\tG\t.\t.\t.\tGT\t0/1\t0/0',
    'ctgA\t200\trs2\tC\tT\t.\t.\t.\tGT\t0/0\t0/0',
  ])
  const names = (readGenotypes: boolean) =>
    analyzeVariants({
      features,
      siteFilter: MAF_FLOOR,
      keepSampleLessSites: true,
      readGenotypes,
    }).filteredVariants.map(v => v.feature.get('name'))
  expect(names(true)).toEqual(['rs1'])
  expect(names(false)).toEqual(['rs1', 'rs2'])
})

// the first count passes a site no sample calls on to the walk, which drops it
// where samples were read
test('a site filter drops a sampled VCF site no sample calls', () => {
  const analyzed = analyzeVariants({
    features: twoSamples([
      'ctgA\t100\trs1\tA\tG\t.\t.\t.\tGT\t0/1\t0/0',
      'ctgA\t200\trs2\tC\tT\t.\t.\t.\tGT\t./.\t./.',
    ]),
    siteFilter: MAF_FLOOR,
    keepSampleLessSites: true,
  })
  expect(analyzed.filteredVariants.map(v => v.feature.get('name'))).toEqual([
    'rs1',
  ])
})
