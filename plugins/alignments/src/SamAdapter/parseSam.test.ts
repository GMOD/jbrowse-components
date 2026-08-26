import { parseSamHeaderLine, parseSamLine } from './parseSam.ts'

const READ =
  'read1\t99\tctgA\t101\t60\t5M2I3D4M\t=\t301\t150\tACGTACGTA\tIIIIIIIII\tNM:i:3\tMD:Z:5^ACG4\tRG:Z:grp1'

test('parses the positional columns into interbase coordinates', () => {
  const record = parseSamLine(READ)
  expect(record.name).toBe('read1')
  expect(record.flags).toBe(99)
  expect(record.refName).toBe('ctgA')
  // POS is 1-based, features are interbase
  expect(record.start).toBe(100)
  // 5M + 3D + 4M consumes 12 reference bases; the 2I consumes none
  expect(record.end).toBe(112)
  expect(record.mapq).toBe(60)
  expect(record.CIGAR).toBe('5M2I3D4M')
  expect(record.seq).toBe('ACGTACGTA')
  expect(record.template_length).toBe(150)
})

// '=' in RNEXT means "same reference as this record", which the mate-related
// color modes compare against refName
test('resolves an RNEXT of = to this record reference', () => {
  const record = parseSamLine(READ)
  expect(record.next_ref).toBe('ctgA')
  expect(record.next_pos).toBe(300)
})

test('types tags by their SAM type letter', () => {
  const { tags } = parseSamLine(READ)
  expect(tags.NM).toBe(3)
  expect(tags.MD).toBe('5^ACG4')
  expect(tags.RG).toBe('grp1')
})

test('decodes QUAL from ASCII-33 phred', () => {
  expect([...parseSamLine(READ).qual!]).toEqual(new Array(9).fill(40))
})

test('an unset QUAL is absent rather than a run of zeros', () => {
  const record = parseSamLine('read2\t0\tctgA\t1\t0\t4M\t*\t0\t0\tACGT\t*')
  expect(record.qual).toBeUndefined()
})

// an unmapped or CIGAR-less record still has to be findable by an interval
// search, so it falls back to spanning its own read length
test('a record with no CIGAR spans its read length', () => {
  const record = parseSamLine('read3\t4\tctgA\t51\t0\t*\t*\t0\t0\tACGTA\t*')
  expect(record.CIGAR).toBe('')
  expect(record.start).toBe(50)
  expect(record.end).toBe(55)
})

test('a record with neither CIGAR nor SEQ still spans one base', () => {
  expect(parseSamLine('read4\t4\tctgA\t51\t0\t*\t*\t0\t0\t*\t*').end).toBe(51)
})

test('a header line parses into tag/value pairs', () => {
  expect(parseSamHeaderLine('@SQ\tSN:ctgA\tLN:50001')).toEqual({
    tag: 'SQ',
    data: [
      { tag: 'SN', value: 'ctgA' },
      { tag: 'LN', value: '50001' },
    ],
  })
})

// an @CO comment has no tag:value structure at all, and must not throw
test('a comment header line yields no pairs', () => {
  expect(parseSamHeaderLine('@CO\tconverted from PSL').tag).toBe('CO')
})

// A `B` array's subtype letter is not part of its value. Carrying it through
// made the first element NaN in every consumer that splits on commas, which is
// how ML probabilities ended up shifted one call late on a SAM track.
test('a B array tag drops its subtype letter', () => {
  const { tags } = parseSamLine(`${READ}\tML:B:C,251,0,128\tMM:Z:C+m?,0,1;`)
  expect(tags.ML).toBe('251,0,128')
  expect(tags.MM).toBe('C+m?,0,1;')
})

test('an empty B array parses to an empty value', () => {
  expect(parseSamLine(`${READ}\tML:B:C`).tags.ML).toBe('')
})
