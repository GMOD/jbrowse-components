import { deflate } from 'pako-esm2'

import HicFile from './hicFile.ts'

import type MatrixZoomData from './matrixZoomData.ts'

// The real .hic in verify.test.ts is v8 and stores every block list-of-rows, so
// the dense encoding, the pre-v7 encoding, and the "no value" filters that go
// with them have no coverage from it. Synthesize blocks byte-for-byte instead.

const SHORT_MIN = -32768

class BlockWriter {
  private bytes: number[] = []
  private scratch = new DataView(new ArrayBuffer(4))

  private push(width: number, write: (v: DataView) => void) {
    write(this.scratch)
    for (let i = 0; i < width; i++) {
      this.bytes.push(this.scratch.getUint8(i))
    }
    return this
  }

  byte(v: number) {
    this.bytes.push(v)
    return this
  }
  short(v: number) {
    return this.push(2, d => {
      d.setInt16(0, v, true)
    })
  }
  int(v: number) {
    return this.push(4, d => {
      d.setInt32(0, v, true)
    })
  }
  float(v: number) {
    return this.push(4, d => {
      d.setFloat32(0, v, true)
    })
  }

  /** Deflated, as blocks are stored on disk. */
  deflated() {
    const out = deflate(new Uint8Array(this.bytes), {})
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength)
  }
}

// readBlock's only inputs are the file bytes and the version, so stub the rest.
async function readBlock(version: number, w: BlockWriter) {
  const data = w.deflated()
  const file = new HicFile({
    file: { read: () => Promise.resolve(data) },
  })
  Object.assign(file as unknown as Record<string, unknown>, { version })
  const zd = {
    blockIndex: { 0: { filePosition: 0, size: data.byteLength } },
  } as unknown as MatrixZoomData
  return (await file.readBlock(0, zd))!.records
}

/** Read a block back as tuples, which is what the fixtures are written as. */
function tuples(recs: {
  bin1: Int32Array
  bin2: Int32Array
  counts: Float32Array
}) {
  return [...recs.bin1].map((b1, i) => [b1, recs.bin2[i]!, recs.counts[i]!])
}

// header shared by every v7/v8 block: nRecords, binXOffset, binYOffset,
// useFloatContact, type
function v8Header(nRecords: number, useFloat: boolean, type: number) {
  return new BlockWriter()
    .int(nRecords)
    .int(100) // binXOffset
    .int(200) // binYOffset
    .byte(useFloat ? 1 : 0)
    .byte(type)
}

describe('list-of-rows blocks (type 1)', () => {
  test('rows fill the exact record count the header declares', async () => {
    // 2 rows of 2 and 1 columns = 3 records, matching nRecords
    const w = v8Header(3, true, 1)
      .short(2) // rowCount
      .short(0) // dy -> binY 200
      .short(2) // colCount
      .short(1)
      .float(5) // dx 1 -> binX 101
      .short(4)
      .float(6) // dx 4 -> binX 104
      .short(3) // dy -> binY 203
      .short(1) // colCount
      .short(0)
      .float(7)

    expect(tuples(await readBlock(8, w))).toEqual([
      [101, 200, 5],
      [104, 200, 6],
      [100, 203, 7],
    ])
  })

  test('short counts are read as counts, not as positions', async () => {
    const w = v8Header(1, false, 1).short(1).short(0).short(1).short(2).short(9)
    expect(tuples(await readBlock(8, w))).toEqual([[102, 200, 9]])
  })

  test('a block whose rows overflow its declared count throws', async () => {
    // declares 1 record but supplies 3 — a truncated write would silently drop
    // the tail, so this must be loud
    const w = v8Header(1, true, 1)
      .short(1)
      .short(0)
      .short(3)
      .short(0)
      .float(1)
      .short(1)
      .float(2)
      .short(2)
      .float(3)
    await expect(readBlock(8, w)).rejects.toThrow(/declares 1 records/)
  })
})

describe('dense blocks (type 2)', () => {
  // nPts counts every cell of the w-wide rectangle, empty ones included, so it
  // over-sizes the decode buffer and the survivors are what matter
  test('float NaN cells are dropped and the rest keep their grid position', async () => {
    // 2x2 rectangle, row-major, with the second cell empty
    const w = v8Header(4, true, 2)
      .int(4) // nPts
      .short(2) // width
      .float(1)
      .float(Number.NaN)
      .float(3)
      .float(4)

    expect(tuples(await readBlock(8, w))).toEqual([
      [100, 200, 1], // i=0 -> row 0, col 0
      [100, 201, 3], // i=2 -> row 1, col 0
      [101, 201, 4], // i=3 -> row 1, col 1
    ])
  })

  test('short Short_MIN_VALUE cells are dropped', async () => {
    const w = v8Header(4, false, 2)
      .int(4)
      .short(2)
      .short(SHORT_MIN)
      .short(7)
      .short(SHORT_MIN)
      .short(8)

    expect(tuples(await readBlock(8, w))).toEqual([
      [101, 200, 7],
      [101, 201, 8],
    ])
  })

  test('the arrays are trimmed to the surviving count, not left oversized', async () => {
    const w = v8Header(4, true, 2)
      .int(4)
      .short(2)
      .float(1)
      .float(Number.NaN)
      .float(Number.NaN)
      .float(Number.NaN)
    const recs = await readBlock(8, w)
    // all three stay parallel — a stale length here would read garbage bins
    expect(recs.bin1.length).toBe(1)
    expect(recs.bin2.length).toBe(1)
    expect(recs.counts.length).toBe(1)
    // and the buffer itself is trimmed, since blocks outlive the fetch in the
    // block cache
    expect(recs.bin1.buffer.byteLength).toBe(4)
  })

  test('an all-empty dense block is empty, not four zero-count contacts', async () => {
    const w = v8Header(2, true, 2)
      .int(2)
      .short(1)
      .float(Number.NaN)
      .float(Number.NaN)
    expect(tuples(await readBlock(8, w))).toEqual([])
  })
})

describe('pre-v7 blocks', () => {
  test('records are read as flat int/int/float triples', async () => {
    const w = new BlockWriter()
      .int(2)
      .int(11)
      .int(22)
      .float(3)
      .int(44)
      .int(55)
      .float(6)
    expect(tuples(await readBlock(6, w))).toEqual([
      [11, 22, 3],
      [44, 55, 6],
    ])
  })
})

test('an unknown block type throws rather than returning nothing', async () => {
  await expect(readBlock(8, v8Header(1, true, 3).int(0))).rejects.toThrow(
    /Unknown block type: 3/,
  )
})
