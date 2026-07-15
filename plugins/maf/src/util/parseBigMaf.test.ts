import { parseAssemblyAndChrSimple } from './parseAssemblyName.ts'
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
    parseAssemblyAndChrSimple,
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

test('attaches i-line context to the preceding s line', () => {
  const { alignments } = parseBigMafStanza(stanza, parseAssemblyAndChrSimple)
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

test('parses e lines into empties, not alignments', () => {
  const { alignments, empties } = parseBigMafStanza(
    stanza,
    parseAssemblyAndChrSimple,
  )
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
  const { alignments } = parseBigMafStanza(s, parseAssemblyAndChrSimple)
  expect(alignments.mm10!.strand).toBe(-1)
  // q line must not create a spurious record
  expect(Object.keys(alignments).sort()).toEqual(['hg18', 'mm10'])
})

test('drops rows the resolver rejects', () => {
  const { alignments, empties } = parseBigMafStanza(stanza, () => undefined)
  expect(Object.keys(alignments)).toHaveLength(0)
  expect(Object.keys(empties)).toHaveLength(0)
})
