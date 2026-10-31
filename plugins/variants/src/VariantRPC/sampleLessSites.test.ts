import VcfParser from '@gmod/vcf'

import { computeVariantCells } from '../LinearMultiSampleVariantDisplay/components/computeVariantCells.ts'
import VcfFeature from '../VcfFeature/index.ts'
import { analyzeVariants } from './analyzeVariants.ts'

// A sites-only VCF, as ClinVar ships: no FORMAT and no sample columns.
const LINES = [
  'ctgA\t100\trs1\tA\tG\t.\t.\tCLNSIG=Benign',
  'ctgA\t200\tsv1\tN\t<DEL>\t.\t.\tSVTYPE=DEL;END=900',
]

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
    referenceDrawingMode: 'skip',
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
  const parser = new VcfParser({
    header: '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tS1\tS2',
  })
  const features = [
    'ctgA\t100\trs1\tA\tG\t.\t.\t.\tGT\t0/1\t0/0',
    'ctgA\t200\trs2\tC\tT\t.\t.\t.\tGT\t./.\t./.',
  ].map(
    (line, i) =>
      new VcfFeature({ parser, variant: parser.parseLine(line), id: `f${i}` }),
  )
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
