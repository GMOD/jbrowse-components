import VcfParser from '@gmod/vcf'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { computeVariantCells } from '../LinearVariantDisplay/components/computeVariantCells.ts'
import VcfFeature from '../VcfFeature/index.ts'
import { recordFieldReaders } from '../shared/recordFields.ts'
import { analyzeVariants } from './analyzeVariants.ts'

const LINES = [
  'ctgA\t100\trs1\tA\tG\t.\t.\tCLNSIG=Benign;GENEINFO=BRCA1',
  'ctgA\t200\trs2\tC\tT\t.\t.\tCLNSIG=Pathogenic',
]

function cellsReading(reads: { tooltip: string; facet: string }) {
  const parser = new VcfParser({
    header: '#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO',
  })
  const features = LINES.map(
    (line, i) =>
      new VcfFeature({ parser, variant: parser.parseLine(line), id: `f${i}` }),
  )
  return computeVariantCells({
    ...analyzeVariants({ features, keepSampleLessSites: true }),
    sources: [],
    unit: 'sample',
    referenceDrawingMode: 'skip',
    recordFields: recordFieldReaders(reads, createJexlInstance()),
  })
}

test('the worker reads the records band fields off the whole record', () => {
  const cells = cellsReading({
    tooltip: 'jexl:get(feature,"INFO").GENEINFO',
    facet: 'INFO.CLNSIG',
  })
  expect(cells.featureInfo.map(i => [i.tooltip, i.groupKey])).toEqual([
    ['BRCA1', 'Benign'],
    ['', 'Pathogenic'],
  ])
})

test('an unread field costs the record an empty string', () => {
  const cells = cellsReading({ tooltip: '', facet: '' })
  expect(cells.featureInfo.map(i => [i.tooltip, i.groupKey])).toEqual([
    ['', ''],
    ['', ''],
  ])
})
