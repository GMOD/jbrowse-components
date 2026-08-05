import { parseAssemblyAndChr } from './parseAssemblyName.ts'
import { parseBigMafStanza } from './parseBigMaf.ts'

// bigMaf joins the lines of a MAF stanza with ';'. Example adapted from the
// UCSC MAF spec (s + i + e lines).
const stanza = [
  's hg18.chr7 27707221 13 + 158545518 gcagctgaaaaca',
  's panTro1.chr6 28869787 13 + 161576975 gcagctgaaaaca',
  'i panTro1.chr6 N 0 C 0',
  's baboon 249182 13 + 4622798 gcagctgaaaaca',
  'i baboon I 234 n 19',
  'e mm4.chr6 53310102 13 + 151104725 I',
].join(';')

test('parses s lines with strand + srcSize, first as reference', () => {
  const { alignments, referenceSeq } = parseBigMafStanza(
    stanza,
    parseAssemblyAndChr,
  )
  expect(referenceSeq).toBe('gcagctgaaaaca')
  expect(alignments.hg18).toEqual({
    chr: 'chr7',
    start: 27707221,
    seq: 'gcagctgaaaaca',
    strand: 1,
    srcSize: 158545518,
  })
})

test('attaches i-line context to the row the i line names', () => {
  const { alignments } = parseBigMafStanza(stanza, parseAssemblyAndChr)
  expect(alignments.panTro1!.context).toEqual({
    leftStatus: 'N',
    leftCount: 0,
    rightStatus: 'C',
    rightCount: 0,
  })
  expect(alignments.baboon!.context).toEqual({
    leftStatus: 'I',
    leftCount: 234,
    rightStatus: 'n',
    rightCount: 19,
  })
})

// UCSC emits each `i` directly after its `s`, so "the preceding s line" and
// "the row the i line names" agree there — but only there. A stanza carrying
// `i` lines for some rows only, or listing them together after the `s` block,
// hung one species' context on another's row.
test('i-line context does not fall through to an unrelated row', () => {
  const s = [
    's hg18.chr7 100 4 + 1000 ACGT',
    's panTro1.chr6 200 4 + 900 acgt',
    's baboon 300 4 + 800 acgt',
    'i panTro1.chr6 N 0 C 0',
  ].join(';')
  const { alignments } = parseBigMafStanza(s, parseAssemblyAndChr)
  expect(alignments.panTro1!.context).toEqual({
    leftStatus: 'N',
    leftCount: 0,
    rightStatus: 'C',
    rightCount: 0,
  })
  expect(alignments.baboon!.context).toBeUndefined()
})

// The resolver is the sample filter, so an `i` line for a species the track
// does not list has no row to attach to and is dropped rather than landing on
// whichever row happened to be parsed last.
test('an i line for an unresolved species attaches to nothing', () => {
  const s = ['s hg18.chr7 100 4 + 1000 ACGT', 'i rheMac3.chr1 N 0 C 0'].join(
    ';',
  )
  const { alignments } = parseBigMafStanza(s, token =>
    token.startsWith('hg18') ? parseAssemblyAndChr(token) : undefined,
  )
  expect(alignments.hg18!.context).toBeUndefined()
})

test('parses e lines into empties, not alignments', () => {
  const { alignments, empties } = parseBigMafStanza(stanza, parseAssemblyAndChr)
  expect(alignments.mm4).toBeUndefined()
  expect(empties.mm4).toEqual({
    chr: 'chr6',
    start: 53310102,
    size: 13,
    strand: 1,
    srcSize: 151104725,
    status: 'I',
  })
})

test('handles negative strand and leading whitespace, ignores q lines', () => {
  const s = [
    's hg18.chr7 100 4 + 1000 ACGT',
    's mm10.chr1 200 4 - 5000 acgt',
    'q mm10.chr1 9999',
  ].join(';')
  const { alignments } = parseBigMafStanza(s, parseAssemblyAndChr)
  expect(alignments.mm10!.strand).toBe(-1)
  // q line must not create a spurious record
  expect(Object.keys(alignments).sort()).toEqual(['hg18', 'mm10'])
})

// bigMaf and TAF used a first-dot split here while MAF-tabix used the
// version-aware one, so the same haplotype-suffixed genome discovered as a
// different sample id (and a different `chr`) per file format.
test('a haplotype-suffixed genome keeps its suffix in the sample id', () => {
  const s = [
    's hg38.chr7 100 4 + 1000 ACGT',
    's HG002.1.chr7 200 4 + 900 acgt',
  ].join(';')
  const { alignments } = parseBigMafStanza(s, parseAssemblyAndChr)
  expect(alignments['HG002.1']).toMatchObject({ chr: 'chr7', start: 200 })
})

test('drops rows the resolver rejects', () => {
  const { alignments, empties } = parseBigMafStanza(stanza, () => undefined)
  expect(Object.keys(alignments)).toHaveLength(0)
  expect(Object.keys(empties)).toHaveLength(0)
})
