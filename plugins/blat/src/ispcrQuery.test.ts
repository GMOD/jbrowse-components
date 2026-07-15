import { BlatChallengeError } from './blatQuery.ts'
import { buildIsPcrBody, parseIsPcrResponse } from './ispcrQuery.ts'

// hgPcr wraps FASTA amplicons in an HTML <PRE> block; a plus-strand and a
// minus-strand product with their two primers in the header
const response = `<HTML><BODY><PRE>
&gt;chr9:132576352+132576623 272bp GTGACGTCGTGACCTAGG CCTAGGTTGACGTCACGA
GTGACGTCGTGACCTAGGaaaaCCTAGGTTGACGTCACGA
&gt;chr17:100-250 151bp AAAAACCCCCGGGGGTTT TTTGGGGGCCCCCAAAAA
ACGTACGT
</PRE></BODY></HTML>`

test('parses a plus-strand amplicon with interbase coords', () => {
  const [f] = parseIsPcrResponse(response)
  expect(f!.refName).toBe('chr9')
  expect(f!.start).toBe(132576351)
  expect(f!.end).toBe(132576623)
  expect(f!.strand).toBe(1)
  expect(f!.name).toBe('272 bp')
})

test('primer footprints anchor at each end, forward at low coord on + strand', () => {
  const [f] = parseIsPcrResponse(response)
  expect(f!.subfeatures).toHaveLength(2)
  // forward primer (18bp) at the low-coordinate end
  expect(f!.subfeatures![0]).toMatchObject({
    start: 132576351,
    end: 132576351 + 18,
    type: 'primer',
  })
  // reverse primer (18bp) at the high-coordinate end
  expect(f!.subfeatures![1]).toMatchObject({
    start: 132576623 - 18,
    end: 132576623,
  })
})

test('parses a minus-strand amplicon', () => {
  const f = parseIsPcrResponse(response)[1]
  expect(f!.refName).toBe('chr17')
  expect(f!.strand).toBe(-1)
  expect(f!.start).toBe(99)
  expect(f!.end).toBe(250)
})

test('labels primer footprints by the primer that sits there on a minus product', () => {
  // on a minus-strand product the reverse primer footprint is at the low
  // coordinate and the forward primer at the high coordinate
  const [low, high] = parseIsPcrResponse(response)[1]!.subfeatures!
  expect(low!).toMatchObject({
    uniqueId: 'ispcr-chr17-99-250--1-rev',
    start: 99,
    name: 'reverse primer',
  })
  expect(high!).toMatchObject({
    uniqueId: 'ispcr-chr17-99-250--1-fwd',
    end: 250,
    name: 'forward primer',
  })
})

test('throws BlatChallengeError on a Cloudflare turnstile page', () => {
  expect(() =>
    parseIsPcrResponse('<html><div class="cf-turnstile"></div></html>'),
  ).toThrow(BlatChallengeError)
})

test('returns no features when there are no products', () => {
  expect(
    parseIsPcrResponse('<HTML><BODY>No matches found</BODY></HTML>'),
  ).toEqual([])
})

test('builds a POST body with primers and product size cap', () => {
  const body = buildIsPcrBody({
    db: 'hg38',
    forwardPrimer: 'GTGACGTCGTGACCTAGG',
    reversePrimer: 'CCTAGGTTGACGTCACGA',
    maxProductSize: 4000,
  })
  const params = new URLSearchParams(body)
  expect(params.get('db')).toBe('hg38')
  expect(params.get('wp_f')).toBe('GTGACGTCGTGACCTAGG')
  expect(params.get('wp_r')).toBe('CCTAGGTTGACGTCACGA')
  expect(params.get('wp_size')).toBe('4000')
  expect(params.get('wp_target')).toBe('genome')
})
