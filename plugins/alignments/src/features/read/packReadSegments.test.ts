import {
  READ_PACK_CATEGORY_BITS,
  READ_PACK_CATEGORY_SHIFT,
  READ_PACK_EDGE_BITS,
  READ_PACK_EDGE_SHIFT,
  READ_PACK_FLAGS_MASK,
  READ_PACK_FLAGS_SHIFT,
  READ_PACK_INTERCHROM_SHIFT,
  READ_PACK_ROW_BITS,
  READ_PACK_ROW_SHIFT,
  READ_PACK_STRAND_BITS,
  READ_PACK_STRAND_SHIFT,
  RC_MAPQ_UNAVAILABLE,
} from '../../shaders/slang/read.consts.generated.ts'
import {
  INSTANCE_OFFSET_F32,
  INSTANCE_OFFSET_U32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS,
} from '../../shaders/slang/read.iface.generated.ts'
import { bitField } from '../../shaders/slang/read.js.generated.ts'
import { packReadSegments } from './mark.ts'

const PAIRED = 0x1
const PROPER_PAIR = 0x2
const MATE_UNMAPPED = 0x8
const SUPPLEMENTARY = 0x800

const reads = [
  {
    y: 0,
    category: 0,
    strand: -1,
    interchrom: 0,
    flags: PAIRED | MATE_UNMAPPED | PROPER_PAIR,
  },
  {
    y: 65535,
    category: RC_MAPQ_UNAVAILABLE,
    strand: 1,
    interchrom: 1,
    flags: SUPPLEMENTARY,
  },
  { y: 1234, category: 7, strand: 0, interchrom: 1, flags: PAIRED },
  { y: 42, category: 31, strand: 1, interchrom: 0, flags: MATE_UNMAPPED },
]
const edgeFlags = [0b01, 0b10, 0b11, 0b00]

const region = {
  readPositions: new Uint32Array(reads.length * 2),
  readYs: Uint16Array.from(reads, r => r.y),
  readStrands: Int8Array.from(reads, r => r.strand),
  readFlags: Uint16Array.from(reads, r => r.flags),
  readPairOrientations: new Uint8Array(reads.length),
  readFillColors: Uint32Array.from(reads, (_, i) => 0xff000000 + i),
  readColorCategories: Uint8Array.from(reads, r => r.category),
  readMapqs: new Uint8Array(reads.length),
  readInsertSizes: Float32Array.from(reads, (_, i) => -150.5 * i),
  readInterchrom: Uint8Array.from(reads, r => r.interchrom),
  segmentPositions: Uint32Array.from(reads.flatMap((_, i) => [i, 4e9 + i])),
  segmentReadIndices: Uint32Array.from(reads, (_, i) => i),
  segmentEdgeFlags: Uint8Array.from(edgeFlags),
}

const buf = packReadSegments(region)
const u32 = new Uint32Array(buf)
const f32 = new Float32Array(buf)

function unpack(i: number) {
  const o = i * INSTANCE_STRIDE_WORDS
  const word = u32[o + INSTANCE_OFFSET_U32.packedFields]!
  return {
    startOff: u32[o + INSTANCE_OFFSET_U32.startOff],
    endOff: u32[o + INSTANCE_OFFSET_U32.endOff],
    insertSize: f32[o + INSTANCE_OFFSET_F32.insertSize],
    fillColor: u32[o + INSTANCE_OFFSET_U32.fillColor],
    y: bitField(word, READ_PACK_ROW_SHIFT, READ_PACK_ROW_BITS),
    category: bitField(word, READ_PACK_CATEGORY_SHIFT, READ_PACK_CATEGORY_BITS),
    strand: bitField(word, READ_PACK_STRAND_SHIFT, READ_PACK_STRAND_BITS) - 1,
    edgeFlags: bitField(word, READ_PACK_EDGE_SHIFT, READ_PACK_EDGE_BITS),
    interchrom: bitField(word, READ_PACK_INTERCHROM_SHIFT, 1),
    flags: (word >>> READ_PACK_FLAGS_SHIFT) & READ_PACK_FLAGS_MASK,
  }
}

test('a read instance is five 32-bit words', () => {
  expect(INSTANCE_STRIDE_BYTES).toBe(20)
  expect(buf.byteLength).toBe(reads.length * 20)
})

test('the packed word fits in 32 bits', () => {
  expect(
    READ_PACK_FLAGS_SHIFT + 32 - Math.clz32(READ_PACK_FLAGS_MASK),
  ).toBeLessThanOrEqual(32)
})

test.each(reads.map((r, i) => ({ i, r })))(
  'read $i round-trips through the shader decode',
  ({ i, r }) => {
    expect(unpack(i)).toEqual({
      startOff: i,
      endOff: 4e9 + i,
      insertSize: -150.5 * i,
      fillColor: 0xff000000 + i,
      y: r.y,
      category: r.category,
      strand: r.strand,
      edgeFlags: edgeFlags[i],
      interchrom: r.interchrom,
      flags: r.flags & (PAIRED | MATE_UNMAPPED),
    })
  },
)
