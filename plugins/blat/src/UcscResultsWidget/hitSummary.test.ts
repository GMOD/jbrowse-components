import { parseBlatResponse, pslToFeatures } from '../blatQuery.ts'
import { parseIsPcrResponse } from '../ispcrQuery.ts'
import { hitSummary } from './hitSummary.ts'

// a one-hit hgBlat output=json body, the same shape the dialog parses
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

test('a BLAT hit summarizes as identity and query coverage', () => {
  expect(hitSummary(pslToFeatures(parseBlatResponse(BLAT_JSON))[0]!)).toBe(
    'YourSeq, 98.7% identity, 100% of query',
  )
})

// hgPcr products carry no identity or coverage, so a summary written for BLAT
// would print two blanks here
test('an in-silico PCR product summarizes as size and primer pair', () => {
  expect(hitSummary(parseIsPcrResponse(ISPCR_HTML)[0]!)).toBe(
    '272 bp, GTGACGTCG / CCTAGGTTG',
  )
})
