import { parseBlatResponse } from '../blatQuery.ts'
import { parseIsPcrResponse } from '../ispcrQuery.ts'
import { columnsFor } from './resultColumns.ts'

// a two-hit hgBlat output=json body, same shape the dialog parses
const BLAT_JSON = JSON.stringify({
  fields: [
    'matches',
    'misMatches',
    'repMatches',
    'nCount',
    'qNumInsert',
    'qBaseInsert',
    'tNumInsert',
    'tBaseInsert',
    'strand',
    'qName',
    'qSize',
    'qStart',
    'qEnd',
    'tName',
    'tSize',
    'tStart',
    'tEnd',
    'blockCount',
    'blockSizes',
    'qStarts',
    'tStarts',
  ],
  blat: [
    // prettier-ignore
    [145, 2, 0, 0, 0, 0, 0, 0, '+', 'YourSeq', 147, 0, 147, 'chr17', 81195210, 7579838, 7579985, 1, '147', '0', '7579838'],
  ],
})

const ISPCR_HTML =
  '<PRE>\n&gt;chr9:132576352+132576623 272bp GTGACGTCG CCTAGGTTG\nACGT\n</PRE>'

test('a BLAT hit gets the identity/coverage columns', () => {
  const columns = columnsFor(parseBlatResponse(BLAT_JSON))
  expect(columns.map(c => c.label)).toEqual([
    'Query',
    'Location',
    'Strand',
    'Identity',
    'Coverage',
    'Score',
  ])
})

// hgPcr products carry no identity/coverage, so offering those columns would
// print a table of blanks
test('an in-silico PCR product gets the product/primer columns', () => {
  const features = parseIsPcrResponse(ISPCR_HTML)
  const columns = columnsFor(features)
  expect(columns.map(c => c.label)).toEqual([
    'Product',
    'Location',
    'Strand',
    'Primers',
  ])
  expect(columns.map(c => c.cell(features[0]!))).toEqual([
    '272 bp',
    'chr9:132576352-132576623',
    '+',
    'GTGACGTCG / CCTAGGTTG',
  ])
})
