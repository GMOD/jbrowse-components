import fs from 'fs'

import { LocalFile } from 'generic-filehandle2'

import {
  decodeSeqRecord,
  getSequencesForOrdinalsBinary,
  looksLikeSeqBinary,
} from './gfaSeqBinaryIO.ts'
import { getSequencesForOrdinals } from './gfaSeqIO.ts'

import type { SeqBinaryShard } from './gfaSeqBinaryIO.ts'
import type { SeqShard } from './gfaSeqIO.ts'
import type { GenericFilehandle } from 'generic-filehandle2'

const SEQB_MAGIC = new Uint8Array([0x53, 0x45, 0x51, 0x42])
const SEQI_MAGIC = new Uint8Array([0x53, 0x45, 0x51, 0x49])

function makeMemoryFile(bytes: Uint8Array): GenericFilehandle {
  return {
    async read(length: number, position: number) {
      const out = new Uint8Array(length)
      out.set(bytes.subarray(position, position + length))
      return out
    },
    async readFile() {
      const out = new Uint8Array(bytes.length)
      out.set(bytes)
      return out
    },
    async stat() {
      return { size: bytes.length }
    },
    async close() {},
  } as unknown as GenericFilehandle
}

const BASE_TO_2BIT: Record<string, number> = { A: 0, C: 1, G: 2, T: 3 }

// Pack one segment record (the same layout the Rust emitter writes):
//   len:u32 LE | 2bit_pack:ceil(len/4) | n_bitmap:ceil(len/8)
function encodeSegment(seq: string) {
  const len = seq.length
  const packBytes = (len + 3) >> 2
  const nbitmapBytes = (len + 7) >> 3
  const out = new Uint8Array(4 + packBytes + nbitmapBytes)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, len, true)
  for (let i = 0; i < len; i++) {
    const ch = seq[i]!.toUpperCase()
    const code = BASE_TO_2BIT[ch] ?? 0
    out[4 + (i >> 2)]! |= code << (6 - ((i & 3) << 1))
  }
  for (let i = 0; i < len; i++) {
    if (seq[i]!.toUpperCase() === 'N') {
      out[4 + packBytes + (i >> 3)]! |= 1 << (i & 7)
    }
  }
  return out
}

function buildShard(seqs: string[]): SeqBinaryShard {
  const records = seqs.map(encodeSegment)
  const headerLen = 8
  const totalRec = records.reduce((acc, r) => acc + r.byteLength, 0)
  const bin = new Uint8Array(headerLen + totalRec)
  bin.set(SEQB_MAGIC, 0)
  new DataView(bin.buffer).setUint32(4, 1, true)
  let cursor = headerLen
  const offsets: number[] = []
  for (const r of records) {
    offsets.push(cursor)
    bin.set(r, cursor)
    cursor += r.byteLength
  }
  offsets.push(cursor)

  const idx = new Uint8Array(headerLen + offsets.length * 8)
  idx.set(SEQI_MAGIC, 0)
  const idxDv = new DataView(idx.buffer)
  idxDv.setUint32(4, 1, true)
  for (let i = 0; i < offsets.length; i++) {
    idxDv.setBigUint64(headerLen + i * 8, BigInt(offsets[i]!), true)
  }

  return {
    binFile: makeMemoryFile(bin),
    idxFile: makeMemoryFile(idx),
  }
}

const decode = (b: Uint8Array | undefined) =>
  b === undefined ? undefined : new TextDecoder().decode(b)

describe('gfaSeqBinaryIO', () => {
  describe('decodeSeqRecord', () => {
    it('round-trips ACGT through pack + unpack', () => {
      const rec = encodeSegment('ACGTACGTAC')
      expect(decode(decodeSeqRecord(rec))).toBe('ACGTACGTAC')
    })

    it('substitutes N at bitmap-flagged positions', () => {
      const rec = encodeSegment('ACNTANGT')
      expect(decode(decodeSeqRecord(rec))).toBe('ACNTANGT')
    })

    it('handles a single-base segment', () => {
      expect(decode(decodeSeqRecord(encodeSegment('G')))).toBe('G')
      expect(decode(decodeSeqRecord(encodeSegment('N')))).toBe('N')
    })

    it('handles a length that crosses a byte boundary', () => {
      const seq = 'ACGTACGTA' // 9 bases — 3 pack bytes, 2 bitmap bytes
      expect(decode(decodeSeqRecord(encodeSegment(seq)))).toBe(seq)
    })

    it('returns empty for a zero-length record', () => {
      const rec = new Uint8Array(4) // len = 0
      expect(decodeSeqRecord(rec).byteLength).toBe(0)
    })
  })

  describe('looksLikeSeqBinary', () => {
    it('accepts SEQB magic + version 1', () => {
      const head = new Uint8Array(8)
      head.set(SEQB_MAGIC, 0)
      new DataView(head.buffer).setUint32(4, 1, true)
      expect(looksLikeSeqBinary(head)).toBe(true)
    })

    it('rejects wrong magic', () => {
      const head = new Uint8Array(8)
      head.set([0x53, 0x45, 0x51, 0x49], 0) // SEQI, not SEQB
      new DataView(head.buffer).setUint32(4, 1, true)
      expect(looksLikeSeqBinary(head)).toBe(false)
    })

    it('rejects unsupported version', () => {
      const head = new Uint8Array(8)
      head.set(SEQB_MAGIC, 0)
      new DataView(head.buffer).setUint32(4, 99, true)
      expect(looksLikeSeqBinary(head)).toBe(false)
    })

    it('rejects truncated header', () => {
      expect(looksLikeSeqBinary(new Uint8Array(4))).toBe(false)
    })
  })

  describe('getSequencesForOrdinalsBinary', () => {
    it('returns sequences for adjacent ordinals', async () => {
      const shard = buildShard(['ACGT', 'AAAA', 'GCNT'])
      const got = await getSequencesForOrdinalsBinary(shard, [0, 1, 2])
      expect(got.size).toBe(3)
      expect(decode(got.get(0))).toBe('ACGT')
      expect(decode(got.get(1))).toBe('AAAA')
      expect(decode(got.get(2))).toBe('GCNT')
    })

    it('handles non-contiguous ordinals via separate range fetches', async () => {
      const seqs = Array.from({ length: 32 }, (_, i) =>
        i % 2 === 0 ? 'ACGTACGT' : 'GGGG',
      )
      const shard = buildShard(seqs)
      const got = await getSequencesForOrdinalsBinary(shard, [0, 7, 17, 31])
      expect(got.size).toBe(4)
      expect(decode(got.get(0))).toBe('ACGTACGT')
      expect(decode(got.get(7))).toBe('GGGG')
      expect(decode(got.get(17))).toBe('GGGG')
      expect(decode(got.get(31))).toBe('GGGG')
    })

    it('skips ordinals beyond the index', async () => {
      const shard = buildShard(['ACGT', 'GGGG'])
      const got = await getSequencesForOrdinalsBinary(shard, [0, 99])
      expect(got.has(0)).toBe(true)
      expect(got.has(99)).toBe(false)
    })

    it('returns empty Map when no ordinals are requested', async () => {
      const shard = buildShard(['ACGT'])
      const got = await getSequencesForOrdinalsBinary(shard, [])
      expect(got.size).toBe(0)
    })

    it('caches the .idx parse across calls', async () => {
      const shard = buildShard(['ACGT', 'GGGG'])
      expect(shard.idxPromise).toBeUndefined()
      await getSequencesForOrdinalsBinary(shard, [0])
      const afterFirst = shard.idxPromise
      await getSequencesForOrdinalsBinary(shard, [1])
      const afterSecond = shard.idxPromise
      expect(afterFirst).toBeDefined()
      expect(afterFirst).toBe(afterSecond)
    })

    it('throws on SEQI magic mismatch', async () => {
      const shard = buildShard(['ACGT'])
      const badIdx = new Uint8Array(16)
      badIdx.set([0x42, 0x41, 0x44, 0x21], 0) // 'BAD!' magic
      shard.idxFile = makeMemoryFile(badIdx)
      await expect(
        getSequencesForOrdinalsBinary(shard, [0]),
      ).rejects.toThrow(/magic mismatch/)
    })

    it('throws on unsupported version', async () => {
      const shard = buildShard(['ACGT'])
      const badIdx = new Uint8Array(16)
      badIdx.set(SEQI_MAGIC, 0)
      new DataView(badIdx.buffer).setUint32(4, 7, true)
      shard.idxFile = makeMemoryFile(badIdx)
      await expect(
        getSequencesForOrdinalsBinary(shard, [0]),
      ).rejects.toThrow(/version mismatch/)
    })
  })
})

// Tier equivalence: binary and plaintext tiers must return byte-identical
// sequences for the same fixture. Both sides come from the Rust
// preprocessor (the binary fixture is built by `gfa-to-tabix
// --emit-seq-binary` against the same volvox GFA the plaintext tier uses)
// — this is the cross-format integration smoke that catches drift between
// the two emit paths.
const fixturePrefix = require
  .resolve('../../../../test_data/volvox/volvox_pangenome_50.pos.bed.gz')
  .replace('.pos.bed.gz', '')
const binPath = `${fixturePrefix}.segments.seq.bin`
const binIdxPath = `${fixturePrefix}.segments.seq.bin.idx`
const faPath = `${fixturePrefix}.segments.seq.fa`
const faIdxPath = `${fixturePrefix}.segments.seq.idx`
const hasBothTiers =
  fs.existsSync(binPath) &&
  fs.existsSync(binIdxPath) &&
  fs.existsSync(faPath) &&
  fs.existsSync(faIdxPath)
const describeIfBoth = hasBothTiers ? describe : describe.skip

describeIfBoth('gfaSeqBinaryIO ↔ plaintext tier equivalence', () => {
  function makeBinShard(): SeqBinaryShard {
    return {
      binFile: new LocalFile(binPath),
      idxFile: new LocalFile(binIdxPath),
    }
  }
  function makePlaintextShard(): SeqShard {
    return {
      fastaFile: new LocalFile(faPath),
      idxFile: new LocalFile(faIdxPath),
    }
  }

  it('returns byte-identical sequences across the two tiers', async () => {
    const ords = [0, 1, 2, 5, 10, 50, 100, 500, 1000, 1203]
    const [binResult, plainResult] = await Promise.all([
      getSequencesForOrdinalsBinary(makeBinShard(), ords),
      getSequencesForOrdinals(makePlaintextShard(), ords),
    ])
    for (const ord of ords) {
      const bin = binResult.get(ord)
      const plain = plainResult.get(ord)
      if (!bin || !plain) {
        // Both tiers should agree on which ordinals exist; assert that
        // first so a missing fixture row surfaces clearly.
        expect(Boolean(bin)).toBe(Boolean(plain))
        continue
      }
      // Plaintext tier ships ASCII (typically uppercase); binary tier
      // emits uppercase always. Compare case-insensitively to keep the
      // assertion tight regardless of source casing.
      const decode = (b: Uint8Array) =>
        new TextDecoder().decode(b).toUpperCase()
      expect(decode(bin)).toBe(decode(plain))
    }
  })
})
