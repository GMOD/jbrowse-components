import {
  blatQueryProblem,
  blatResidueCount,
  buildBlatBody,
  parseBlatResponse,
  parseFastaRecords,
  parsePslRows,
  pslToFeatures,
  queryLabel,
} from './blatQuery.ts'

// real shape of a UCSC hgBlat output=json response
const response = {
  track: 'blat',
  genome: 'hg38',
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
    [
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
    ],
    [
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
    ],
  ],
}

const features = () => pslToFeatures(parsePslRows(response))

const byRefName = (refName: string) =>
  features().find(f => f.refName === refName)!

test('parses a single-block PSL hit', () => {
  const f = byRefName('chr6')
  expect(f.start).toBe(34345901)
  expect(f.end).toBe(34346047)
  expect(f.strand).toBe(1)
  expect(f.subfeatures).toHaveLength(1)
  expect(f.subfeatures![0]).toMatchObject({
    refName: 'chr6',
    start: 34345901,
    end: 34346047,
  })
})

test('parses a multi-block hit with trailing-comma block lists', () => {
  const f = byRefName('chr17')
  expect(f.strand).toBe(-1)
  expect(f.subfeatures).toHaveLength(3)
  expect(f.subfeatures!.map(s => [s.start, s.end])).toEqual([
    [17301795, 17301826],
    [17301832, 17301933],
    [17302064, 17302077],
  ])
})

// the leading feature is the one the view navigates to, so the order is part of
// the contract, not a presentational detail
test('orders hits best-first by kent pslScore', () => {
  // chr17: 140 + 0 - 5 - 1 - 2 = 132 beats chr6: 133 - 13 = 120
  expect(features().map(f => [f.refName, f.score])).toEqual([
    ['chr17', 132],
    ['chr6', 120],
  ])
})

test('computes UCSC percent identity into the name', () => {
  const f = byRefName('chr6')
  // milliBad = 1000 * 13 misMatches / 146 aligned = 89 -> 100 - 8.9
  expect(f.name).toBe('YourSeq 91.1%')
  expect(f.identity).toBe(91.1)
})

test('charges query inserts against identity, not target span', () => {
  const f = byRefName('chr17')
  // the 282bp target span is an intron rather than a penalty; the single query
  // insert is the only charge: 1000 * (5 + 1) / 145 = 41 -> 100 - 4.1
  expect(f.identity).toBe(95.9)
})

test('reports query coverage alongside identity', () => {
  expect(byRefName('chr6').coverage).toBe(99.3)
  expect(byRefName('chr6').queryName).toBe('YourSeq')
})

// The assumption behind the dialog's calm "No BLAT hits found in hg38": in JSON
// mode a query that matched nothing answers with an empty table, not with a kent
// errAbort page. If UCSC ever changed that, this would still pass while the
// dialog turned red — and browser users would get the proxy's reading of any
// HTML at all, "the apiKey may be invalid or rate-limited", for a query that
// simply had no hits. This is the line to come back to.
test('a query that matched nothing parses as no hits, not an error', () => {
  expect(parseBlatResponse(JSON.stringify({ ...response, blat: [] }))).toEqual(
    [],
  )
})

// a mirror or proxy relaying its own JSON envelope reached `.map` on undefined,
// so the user was shown a TypeError where the server's own words belong
test('rejects JSON that is not a PSL table with a readable message', () => {
  expect(() => parseBlatResponse('{"error":"no such database"}')).toThrow(
    /without the expected fields\/blat columns/,
  )
})

test('surfaces a kent errAbort message from an HTML error page', () => {
  expect(() =>
    parseBlatResponse(
      "<html><body><pre>Error: Can't find database volvox</pre></body></html>",
    ),
  ).toThrow("Can't find database volvox")
})

const multiFasta =
  '>probeA\nACGTACGTACGTACGTACGT\n>probeB\nTTTTGGGGCCCCAAAATTTT\n'

// stripping the headers and joining would submit one 40bp chimera and lose the
// record names, so every hit would come back as an unattributable "YourSeq"
test('submits FASTA verbatim rather than a concatenated sequence', () => {
  const body = new URLSearchParams(
    buildBlatBody({ db: 'hg38', seq: multiFasta }),
  )
  expect(body.get('userSeq')).toBe(multiFasta)
  expect(parseFastaRecords(multiFasta)).toHaveLength(2)
})

test('reads a bare sequence as one unnamed record', () => {
  expect(parseFastaRecords('ACGTACGTACGTACGTACGT')).toEqual([
    { name: undefined, residues: 'ACGTACGTACGTACGTACGT' },
  ])
})

// a paste that starts with bases and then names the rest is two records to
// hgBlat; counting the '>' characters saw one
test('reads bases before the first header as their own record', () => {
  expect(parseFastaRecords('ACGTACGT\n>probeB\nTTTT\n')).toEqual([
    { name: undefined, residues: 'ACGTACGT' },
    { name: 'probeB', residues: 'TTTT' },
  ])
})

test('measures residues without the headers', () => {
  expect(blatResidueCount(parseFastaRecords(multiFasta))).toBe(40)
})

// the length limits are stated in the bases hgBlat counts, and kent's FASTA
// reader keeps letters only — measuring the line numbers of a pasted GenBank
// block, or alignment-gap dashes, holds the query to a length the server never
// applies, and puts the SAM conversion's bases out of register against `qSize`.
test('counts only letters as residues', () => {
  expect(parseFastaRecords('   1 acgtacgtac  gtacgtacgt\n  21 ACGT\n')).toEqual(
    [{ name: undefined, residues: 'acgtacgtacgtacgtacgtACGT' }],
  )
  expect(parseFastaRecords('>gapped\nACGT--ACGT\n')[0]!.residues).toBe(
    'ACGTACGT',
  )
})

test('names the track after the first FASTA record', () => {
  expect(queryLabel(parseFastaRecords(multiFasta))).toBe('probeA')
})

test('names the track after the leading bases of a bare sequence', () => {
  expect(queryLabel(parseFastaRecords('ACGTACGTACGTACGTACGT'))).toBe(
    'ACGTACGTACGT…',
  )
})

const fasta = (sizes: number[]) =>
  parseFastaRecords(
    sizes.map((size, i) => `>probe${i}\n${'A'.repeat(size)}\n`).join(''),
  )

test('a query inside every hgBlat cap has nothing to report', () => {
  expect(blatQueryProblem(fasta([25000, 25000]))).toBe('')
})

// 25,000 is hgBlat's cap on one sequence and 50,000 its cap on the submission.
// Holding the total to 25,000 refused this paste, quoting a limit that applies
// to neither of its records.
test('accepts a multi-record query over the per-sequence cap in total', () => {
  expect(blatQueryProblem(fasta([15000, 15000, 15000]))).toBe('')
})

test('names the per-sequence cap when one record is too long', () => {
  expect(blatQueryProblem(fasta([25001, 100]))).toBe(
    'Longest sequence is 25,001 bp; UCSC BLAT is limited to 25,000 bp per sequence',
  )
})

test('names the combined cap when the records only overrun together', () => {
  expect(blatQueryProblem(fasta([25000, 25000, 1]))).toBe(
    '50,001 bp in total; UCSC BLAT is limited to 50,000 bp per query',
  )
})

test('names the record cap', () => {
  expect(blatQueryProblem(fasta(Array.from({ length: 26 }, () => 100)))).toBe(
    '26 sequences; UCSC BLAT is limited to 25 per query',
  )
})

test('an empty box is not yet a mistake', () => {
  expect(blatQueryProblem(parseFastaRecords(''))).toBe('')
  expect(blatQueryProblem(parseFastaRecords('ACGT'))).toBe(
    'Sequence must be at least 20 bp',
  )
})
