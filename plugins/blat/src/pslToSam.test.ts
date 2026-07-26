import { revcom } from '@jbrowse/core/util'

import { parsePslRows } from './blatQuery.ts'
import {
  parseQuerySequences,
  pslQuerySeq,
  pslToCigar,
  pslToSam,
} from './pslToSam.ts'

const fields = [
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
]

// a forward single-block hit with one unaligned base at each end of the query
const forward = [
  133,
  13,
  0,
  0,
  0,
  0,
  0,
  0,
  '+',
  'YourSeq',
  147,
  1,
  147,
  'chr6',
  170805979,
  34345901,
  34346047,
  1,
  '146',
  '1',
  '34345901',
]

// three blocks on the minus strand: one query insert, two target gaps
const reverse = [
  140,
  5,
  0,
  0,
  1,
  1,
  2,
  137,
  '-',
  'YourSeq',
  147,
  1,
  147,
  'chr17',
  83257441,
  17301795,
  17302077,
  3,
  '31,101,13',
  '0,32,133',
  '17301795,17301832,17302064',
]

const rows = (blat: (string | number)[][]) => parsePslRows({ fields, blat })

// summed op lengths for the given ops, e.g. 'MDN' for the reference span
function cigarSpan(cigar: string, ops: string) {
  let total = 0
  for (const [, length, op] of cigar.matchAll(/(\d+)([A-Z])/g)) {
    if (ops.includes(op!)) {
      total += Number(length)
    }
  }
  return total
}

test('a single block becomes one M run between soft clips', () => {
  expect(pslToCigar(rows([forward])[0]!)).toBe('1S146M')
})

test('a query gap is an I and a target gap a D', () => {
  expect(pslToCigar(rows([reverse])[0]!)).toBe('31M1I6D101M131D13M1S')
})

// the two lengths a CIGAR states have to match the spans PSL states, or the
// alignment would draw at the wrong width or run off its read
test('the CIGAR spans exactly the target and query PSL reports', () => {
  const row = rows([reverse])[0]!
  const cigar = pslToCigar(row)
  expect(cigarSpan(cigar, 'MDN')).toBe(row.tEnd - row.tStart)
  expect(cigarSpan(cigar, 'MIS')).toBe(row.qSize)
})

test('a hit with no unaligned query ends carries no soft clips', () => {
  const flush = [...forward]
  // qStart 0, qEnd 147, one 147bp block
  flush[11] = 0
  flush[12] = 147
  flush[18] = '147'
  flush[19] = '0'
  expect(pslToCigar(rows([flush])[0]!)).toBe('147M')
})

// PSL states a minus-strand hit's query coordinates in reverse-complement
// space, which is the space SAM's SEQ column uses for a reverse-strand record.
// Get this wrong and every base reads as a mismatch.
test('a minus-strand hit carries the reverse-complemented query', () => {
  const queries = new Map([['YourSeq', 'AACCGGTT']])
  expect(pslQuerySeq(rows([reverse])[0]!, queries)).toBe('AACCGGTT')
  expect(pslQuerySeq(rows([forward])[0]!, queries)).toBe('AACCGGTT')
})

test('a plus-strand hit carries the query as submitted', () => {
  const queries = new Map([['YourSeq', 'ACGTTTTT']])
  expect(pslQuerySeq(rows([forward])[0]!, queries)).toBe('ACGTTTTT')
  expect(pslQuerySeq(rows([reverse])[0]!, queries)).toBe('AAAAACGT')
})

test('a hit whose query text is unavailable states no sequence', () => {
  const other = [...forward]
  other[9] = 'probeZ'
  const queries = new Map([
    ['probeA', 'ACGT'],
    ['probeB', 'TTTT'],
  ])
  expect(pslQuerySeq(rows([other])[0]!, queries)).toBeUndefined()
})

// hgBlat renames a headerless query "YourSeq", and truncates long names, so an
// exact match on the name can't be the only way back to the submitted bases
test('a single submitted sequence answers for a hit under any name', () => {
  const other = [...forward]
  other[9] = 'YourSeq_renamed'
  expect(pslQuerySeq(rows([other])[0]!, new Map([['probeA', 'ACGT']]))).toBe(
    'ACGT',
  )
})

const samLines = (blat: (string | number)[][], queries: Map<string, string>) =>
  pslToSam(rows(blat), queries).split('\n').filter(Boolean)

const samRecords = (
  blat: (string | number)[][],
  queries: Map<string, string>,
) => samLines(blat, queries).filter(line => !line.startsWith('@'))

test('emits an @SQ line per target with the size PSL states', () => {
  const lines = samLines([forward, reverse], new Map())
  expect(lines).toContain('@SQ\tSN:chr6\tLN:170805979')
  expect(lines).toContain('@SQ\tSN:chr17\tLN:83257441')
})

// the query has to be qSize long to be carried at all, so it can't be a token
// string here — see the length test below
const query147 = 'ACGTAC'.repeat(25).slice(0, 147)

test('a record carries POS as 1-based, the strand flag, and the query bases', () => {
  const [record] = samRecords([forward], new Map([['YourSeq', query147]]))
  const [name, flag, refName, pos, mapq, cigar, , , , seq] = record!.split('\t')
  expect(name).toBe('YourSeq')
  expect(flag).toBe('0')
  expect(refName).toBe('chr6')
  expect(pos).toBe('34345902')
  // BLAT reports identity, not a mapping probability: 255 is "unavailable"
  expect(mapq).toBe('255')
  expect(cigar).toBe('1S146M')
  expect(seq).toBe(query147)
})

test('a minus-strand record sets the reverse flag', () => {
  const [record] = samRecords([reverse], new Map())
  expect(record!.split('\t')[1]).toBe('16')
})

// every hit after a query's best one is a competing placement of the same
// sequence, which is what 0x100 means — and what keeps the pileup from stacking
// them onto one row as if they were split segments of one read
test('all but the leading hit of a query are secondary', () => {
  const records = samRecords([forward, reverse], new Map())
  // reverse scores higher, so it leads
  expect(records.map(line => line.split('\t')[1])).toEqual(['16', '256'])
})

test('the best hit of each query stays primary', () => {
  const otherQuery = [...forward]
  otherQuery[9] = 'probeB'
  const records = samRecords([reverse, otherQuery], new Map())
  expect(records.map(line => line.split('\t')[1])).toEqual(['16', '0'])
})

test('states the edit distance and the kent score as tags', () => {
  const [record] = samRecords([reverse], new Map())
  // 5 mismatched bases + 1 query-inserted + 137 target-inserted
  expect(record).toContain('NM:i:143')
  expect(record).toContain('AS:i:132')
})

test('a hit with no query text states SEQ as unavailable', () => {
  const [record] = samRecords([forward], new Map())
  expect(record!.split('\t')[9]).toBe('*')
})

// a query of the wrong length can't be the one the rows describe, and carrying
// it anyway puts every base out of register: the pileup then draws a wall of
// mismatches under a hit the widget labels as near-perfect identity
test('a query whose length disagrees with qSize is not carried', () => {
  const [record] = samRecords([forward], new Map([['YourSeq', 'ACGT']]))
  expect(record!.split('\t')[9]).toBe('*')
})

test('a query matching qSize is carried in full, and reverse-complemented on the minus strand', () => {
  const query = query147
  const [fwd] = samRecords([forward], new Map([['YourSeq', query]]))
  const [rev] = samRecords([reverse], new Map([['YourSeq', query]]))
  const seqOf = (record: string) => record.split('\t')[9]!
  expect(seqOf(fwd!)).toBe(query)
  expect(seqOf(rev!)).toHaveLength(query.length)
  expect(seqOf(rev!)).toBe(revcom(query))
  // the invariant that makes the mismatches land in register
  expect(cigarSpan(rev!.split('\t')[5]!, 'MIS')).toBe(seqOf(rev!).length)
})

test('parses submitted FASTA into name-keyed sequences', () => {
  expect([
    ...parseQuerySequences('>probeA\nACGT\nACGT\n>probeB desc\nTTTT\n'),
  ]).toEqual([
    ['probeA', 'ACGTACGT'],
    ['probeB', 'TTTT'],
  ])
})

test('a bare sequence parses under the name hgBlat gives it', () => {
  expect([...parseQuerySequences('ACGT\nACGT\n')]).toEqual([
    ['YourSeq', 'ACGTACGT'],
  ])
})
