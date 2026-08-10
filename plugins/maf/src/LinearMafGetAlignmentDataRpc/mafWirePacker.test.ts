import { MafWirePacker } from './mafWirePacker.ts'
import { packTestWire } from './testWire.ts'

const dec = new TextDecoder()

/** The bytes the wire says belong to row `i`. */
function rowSeq(packed: ReturnType<typeof packTestWire>, i: number) {
  const offset = packed.rowOffset[i]!
  return dec.decode(
    packed.arena.subarray(offset, offset + packed.rowLength[i]!),
  )
}

function refSeq(packed: ReturnType<typeof packTestWire>, block: number) {
  const offset = packed.blockRefOffset[block]!
  return dec.decode(
    packed.arena.subarray(offset, offset + packed.blockRefLength[block]!),
  )
}

test('rows land at the offsets their block claims', () => {
  const packed = packTestWire([
    {
      startBp: 10,
      refSeq: 'ACGT',
      rows: [
        { sampleId: 'hg38', seq: 'ACGT' },
        { sampleId: 'mm10', seq: 'A-GT' },
      ],
    },
    {
      startBp: 40,
      refSeq: 'TTTT',
      rows: [{ sampleId: 'mm10', seq: 'TTAT' }],
    },
  ])
  expect(Array.from(packed.blockRowStart)).toEqual([0, 2, 3])
  expect(rowSeq(packed, 0)).toBe('ACGT')
  expect(rowSeq(packed, 1)).toBe('A-GT')
  expect(rowSeq(packed, 2)).toBe('TTAT')
  expect(refSeq(packed, 0)).toBe('ACGT')
  expect(refSeq(packed, 1)).toBe('TTTT')
})

// Short rows take a `charCodeAt` loop into the arena instead of `encodeInto`
// (see `writeAscii`), and that loop is only valid for ASCII — which MAF
// alignment text is, and which the whole render path already assumes, since
// every consumer indexes a row's bytes by the reference's column number. A row
// that somehow isn't ASCII must still come out exactly as `encodeInto` would
// have written it, including the truncation that gives: the destination is
// `seq.length` bytes, so a multi-byte character fills more than its share and
// the row ends early rather than overflowing into the next one.
test('a non-ASCII short row falls back to encodeInto, byte for byte', () => {
  const seq = 'ACéGT'
  const packed = packTestWire([
    {
      startBp: 0,
      refSeq: 'ACGTA',
      rows: [
        { sampleId: 'a', seq },
        // the row after it must be unaffected by the fallback's re-write
        { sampleId: 'b', seq: 'TTTTT' },
      ],
    },
  ])
  const expected = new TextEncoder().encodeInto(seq, new Uint8Array(seq.length))
  expect(packed.rowLength[0]).toBe(expected.written)
  expect(rowSeq(packed, 0)).toBe(
    new TextDecoder().decode(
      new TextEncoder().encode(seq).subarray(0, expected.written),
    ),
  )
  expect(rowSeq(packed, 1)).toBe('TTTTT')
})

// A row long enough to take the `encodeInto` path must pack the same as a short
// one — the threshold is a performance switch, never a semantic one.
test('rows on either side of the ASCII-copy threshold pack identically', () => {
  const short = 'ACGT'.repeat(4) // 16, under the threshold
  const long = 'ACGT'.repeat(40) // 160, over it
  const packed = packTestWire([
    {
      startBp: 0,
      refSeq: long,
      rows: [
        { sampleId: 'a', seq: short },
        { sampleId: 'b', seq: long },
      ],
    },
  ])
  expect(rowSeq(packed, 0)).toBe(short)
  expect(rowSeq(packed, 1)).toBe(long)
  expect(refSeq(packed, 0)).toBe(long)
})

// The hazard the arena introduced: a row's bytes are immediately followed by the
// next row's, so a length that overstates the row silently reads another
// species' bases as this one's. Every consumer bounds on `rowLength`.
test('a row is bounded by its own length, not by the next row', () => {
  const packed = packTestWire([
    {
      startBp: 0,
      refSeq: 'ACGT',
      rows: [
        { sampleId: 'a', seq: 'AC' },
        { sampleId: 'b', seq: 'GGGG' },
      ],
    },
  ])
  expect(rowSeq(packed, 0)).toBe('AC')
  expect(rowSeq(packed, 1)).toBe('GGGG')
  // adjacent in the arena, so nothing separates them but the length
  expect(packed.rowOffset[1]).toBe(packed.rowOffset[0]! + 2)
})

test('endBp counts reference bases, not reference columns', () => {
  // 3 insertion columns, so the block spans 4 genomic bp from 100.
  const packed = packTestWire([
    {
      startBp: 100,
      refSeq: 'A---CGT',
      rows: [{ sampleId: 'a', seq: 'AGGGCGT' }],
    },
  ])
  expect(packed.blockStartBp[0]).toBe(100)
  expect(packed.blockEndBp[0]).toBe(104)
  // the reference keeps all 7 columns; only its bp extent excludes the dashes
  expect(packed.blockRefLength[0]).toBe(7)
})

test('repeated species and contig names are interned, not repeated', () => {
  const packed = packTestWire([
    {
      startBp: 0,
      refSeq: 'AC',
      rows: [
        { sampleId: 'hg38', seq: 'AC', chr: 'chr1' },
        { sampleId: 'mm10', seq: 'AC', chr: 'chr1' },
      ],
    },
    {
      startBp: 10,
      refSeq: 'AC',
      rows: [{ sampleId: 'hg38', seq: 'AC', chr: 'chr2' }],
    },
  ])
  expect(packed.sampleIds).toEqual(['hg38', 'mm10'])
  expect(packed.chrNames).toEqual(['chr1', 'chr2'])
  // hg38 in both blocks is the same dictionary entry
  expect(packed.rowSample[0]).toBe(packed.rowSample[2])
  expect(packed.rowChr[0]).toBe(packed.rowChr[1])
  expect(packed.rowChr[2]).toBe(1)
})

// MAF-tabix and TAF never produce `i` lines, so they must not pay for five
// zero-filled columns the length of the row list.
test('context columns are absent unless some row carries an i line', () => {
  const without = packTestWire([
    { startBp: 0, refSeq: 'AC', rows: [{ sampleId: 'a', seq: 'AC' }] },
  ])
  expect(without.rowHasContext).toBeUndefined()
  expect(without.rowLeftStatus).toBeUndefined()

  const withContext = packTestWire([
    {
      startBp: 0,
      refSeq: 'AC',
      rows: [
        { sampleId: 'a', seq: 'AC' },
        {
          sampleId: 'b',
          seq: 'AC',
          context: {
            leftStatus: 'I',
            leftCount: 42,
            rightStatus: 'N',
            rightCount: 7,
          },
        },
      ],
    },
  ])
  expect(withContext.rowHasContext).toBeDefined()
  // the flag distinguishes "no i line" from "an i line whose fields were 0"
  expect(Array.from(withContext.rowHasContext!)).toEqual([0, 1])
  expect(withContext.rowLeftCount![1]).toBe(42)
  expect(withContext.rowRightCount![1]).toBe(7)
})

// The context columns are created at the first row carrying an `i` line and
// grown only by a `set`, so the rows after the last one that carries one used to
// fall off the end: `rowHasContext` came back length 1 against 20 rows. Reading
// it stayed correct (a missing entry is falsy, which is "no context"), but the
// columns were ragged against every other per-row array and against what
// `MafWireRegionData` documents them to be.
test('context columns run the full row count, not just up to the last i line', () => {
  const packed = packTestWire([
    {
      startBp: 0,
      refSeq: 'AC',
      rows: [
        { sampleId: 'a', seq: 'AC', context: { leftStatus: 'C' } },
        ...Array.from({ length: 19 }, (_, i) => ({
          sampleId: `s${i}`,
          seq: 'AC',
        })),
      ],
    },
  ])
  const rows = packed.rowOffset.length
  expect(rows).toBe(20)
  for (const column of [
    packed.rowHasContext,
    packed.rowLeftStatus,
    packed.rowLeftCount,
    packed.rowRightStatus,
    packed.rowRightCount,
  ]) {
    expect(column!.length).toBe(rows)
  }
  expect(packed.rowHasContext![19]).toBe(0)
})

test('empties are ranged per block alongside rows', () => {
  const packed = packTestWire([
    {
      startBp: 0,
      refSeq: 'AC',
      rows: [{ sampleId: 'a', seq: 'AC' }],
      empties: [
        {
          sampleId: 'b',
          status: 'C',
          chr: 'chrX',
          start: 5,
          size: 9,
          strand: -1,
          srcSize: 1000,
        },
      ],
    },
    { startBp: 10, refSeq: 'AC', rows: [{ sampleId: 'a', seq: 'AC' }] },
  ])
  expect(Array.from(packed.blockEmptyStart)).toEqual([0, 1, 1])
  expect(packed.emptyStrand[0]).toBe(-1)
  expect(packed.emptySize[0]).toBe(9)
  expect(packed.chrNames[packed.emptyChr[0]!]).toBe('chrX')
})

// The reserve hints are an optimization, so being wrong about them has to stay
// invisible: `executeMafAlignmentData` counts exactly, but the test helper
// passes nothing at all and drives every column through its growth path.
test('columns and arena grow correctly when nothing is reserved', () => {
  const packer = new MafWirePacker()
  const n = 500
  for (let b = 0; b < n; b++) {
    packer.startBlock(b * 10, 'ACGT')
    packer.addRow({ sampleId: `sp${b % 7}`, seq: 'ACGT', start: b })
  }
  const packed = packer.finishBlocks()
  expect(packed.blockStartBp).toHaveLength(n)
  expect(packed.rowOffset).toHaveLength(n)
  expect(packed.arena).toHaveLength(n * 8)
  expect(rowSeq(packed, n - 1)).toBe('ACGT')
  expect(packed.rowStart[n - 1]).toBe(n - 1)
  expect(packed.sampleIds).toHaveLength(7)
  // right-sized, not a view onto the doubling slack
  expect(packed.rowOffset.buffer.byteLength).toBe(n * 4)
  expect(packed.arena.buffer.byteLength).toBe(n * 8)
})

test('an exactly-reserved pack allocates once and still right-sizes', () => {
  const packer = new MafWirePacker({
    blocks: 1,
    rows: 2,
    empties: 0,
    bytes: 12,
  })
  packer.startBlock(0, 'ACGT')
  packer.addRow({ sampleId: 'a', seq: 'ACGT' })
  packer.addRow({ sampleId: 'b', seq: 'ACGT' })
  const packed = packer.finishBlocks()
  expect(packed.arena).toHaveLength(12)
  expect(rowSeq(packed, 1)).toBe('ACGT')
})
