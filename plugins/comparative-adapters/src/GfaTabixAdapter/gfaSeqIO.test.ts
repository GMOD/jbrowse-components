import fs from 'fs'
import path from 'path'

import { LocalFile } from 'generic-filehandle2'

import { getSequencesForOrdinals } from './gfaSeqIO.ts'

import type { SeqShard } from './gfaSeqIO.ts'

const fixturePrefix = require
  .resolve('../../../../test_data/volvox/volvox_pangenome_50.pos.bed.gz')
  .replace('.pos.bed.gz', '')

const fastaPath = `${fixturePrefix}.segments.seq.fa`
const idxPath = `${fixturePrefix}.segments.seq.idx`

const hasSeq = fs.existsSync(fastaPath) && fs.existsSync(idxPath)
const describeIfSeq = hasSeq ? describe : describe.skip

function makeShard(): SeqShard {
  return {
    fastaFile: new LocalFile(fastaPath),
    idxFile: new LocalFile(idxPath),
  }
}

function decode(b: Uint8Array | undefined) {
  if (!b) {
    return undefined
  }
  return new TextDecoder().decode(b)
}

describeIfSeq('gfaSeqIO', () => {
  it('returns sequences for adjacent ordinals', async () => {
    const shard = makeShard()
    const result = await getSequencesForOrdinals(shard, [0, 1, 2])
    expect(result.size).toBe(3)
    const s0 = decode(result.get(0))!
    const s1 = decode(result.get(1))!
    const s2 = decode(result.get(2))!
    // Lengths must agree with the .fai's length column for those ordinals.
    expect(s0.length).toBe(132)
    expect(s1.length).toBe(1)
    expect(s2.length).toBe(27)
    // Sequence is alphabet-only — no header or newline bleed-through.
    expect(/^[ACGTN]+$/i.test(s0)).toBe(true)
    expect(/^[ACGTN]+$/i.test(s2)).toBe(true)
  })

  it('handles non-contiguous ordinals via separate range fetches', async () => {
    const shard = makeShard()
    const ordinals = [0, 50, 100, 200]
    const result = await getSequencesForOrdinals(shard, ordinals)
    expect(result.size).toBe(4)
    for (const ord of ordinals) {
      const seq = decode(result.get(ord))!
      expect(seq.length).toBeGreaterThan(0)
      expect(/^[ACGTN]+$/i.test(seq)).toBe(true)
    }
  })

  it('returns empty Map when no ordinals are requested', async () => {
    const shard = makeShard()
    const result = await getSequencesForOrdinals(shard, [])
    expect(result.size).toBe(0)
  })

  it('skips ordinals beyond the index without throwing', async () => {
    const shard = makeShard()
    const result = await getSequencesForOrdinals(shard, [0, 999_999])
    expect(result.has(0)).toBe(true)
    expect(result.has(999_999)).toBe(false)
  })

  it('caches the .idx parse across calls (idxPromise reuse)', async () => {
    const shard = makeShard()
    const before = shard.idxPromise
    await getSequencesForOrdinals(shard, [0])
    const afterFirst = shard.idxPromise
    await getSequencesForOrdinals(shard, [1])
    const afterSecond = shard.idxPromise
    expect(before).toBeUndefined()
    expect(afterFirst).toBe(afterSecond)
  })

  it('sequences match samtools-faidx-equivalent direct file reads', async () => {
    const shard = makeShard()
    const got = await getSequencesForOrdinals(shard, [0, 1, 5, 10])

    // Re-derive expected values directly from the FASTA + .fai to prove the
    // .idx and the .fai agree on byte offsets and lengths. This catches
    // off-by-one bugs in the rust .idx writer or the adapter byte slicing.
    const faiText = fs.readFileSync(`${fastaPath}.fai`, 'utf8')
    const faiByOrd = new Map<number, { offset: number; length: number }>()
    for (const line of faiText.split('\n')) {
      if (!line.startsWith('seg')) continue
      const cols = line.split('\t')
      const ord = +cols[0]!.slice(3)
      faiByOrd.set(ord, { offset: +cols[2]!, length: +cols[1]! })
    }

    const fa = await fs.promises.open(fastaPath, 'r')
    try {
      for (const ord of [0, 1, 5, 10]) {
        const entry = faiByOrd.get(ord)!
        const buf = Buffer.alloc(entry.length)
        await fa.read(buf, 0, entry.length, entry.offset)
        expect(decode(got.get(ord))).toBe(buf.toString('utf8'))
      }
    } finally {
      await fa.close()
    }
  })
})
