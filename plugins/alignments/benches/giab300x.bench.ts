// The per-read arrays against a REAL 300x WGS BAM, over HTTP range requests.
//
//   node --expose-gc plugins/alignments/benches/giab300x.bench.ts [ref] [start] [end]
//   node --expose-gc plugins/alignments/benches/giab300x.bench.ts 1 10000000 10100000
//
// THIS ONE HITS THE NETWORK, is in no CI run, and is slow (a 100kb window is
// ~40MB of range requests and about 6s to fetch). It exists because the local
// fixtures cannot answer three questions that decided real design choices, and
// all three are properties of the DATA rather than of the code:
//
//   1. Do virtual offsets exceed 2^32? `readKeys` is a `Float64Array` on the
//      argument that they do above ~64GB. This file is 600GB, and the answer
//      here is yes by two orders of magnitude — a `Uint32Array` would have
//      silently truncated every read id on it. Nothing local could show that:
//      the biggest fixture in jb2bench is 268MB.
//   2. How many distinct mate references are there? `readNextRefs` ships slots
//      into a table on the argument that the answer is small. The synthetic
//      fixture says 1, which is not evidence — a real WGS window says 27
//      against 207,260 reads, which is.
//   3. Is SA actually absent? The worker skips the per-read SA tag walk when
//      read connections are off, and the fixture has SA on 0 reads. Real
//      novoalign output also has none (it emits no supplementary alignments),
//      so the walk was pure waste on this file too — but a BWA-MEM file would
//      answer differently and that is worth knowing before generalising.
//
// It also round-trips every read through `readIdAt` / `readNameAt` /
// `nextRefAt` against what the record itself says, which is the correctness
// half and the reason to keep it runnable rather than just writing the numbers
// down. `agent-docs/reference/BENCHMARKING.md` has the rest of the traps.
import { BamFile } from '@gmod/bam'
import { RemoteFile } from 'generic-filehandle2'

import {
  readIdAt,
  readIdPrefixOf,
  readKeyOf,
} from '../src/shared/readIdentity.ts'
import { buildReadNameBlock, readNameAt } from '../src/shared/readNameBlock.ts'
import {
  buildReadInterchrom,
  buildReadNextRefs,
  nextRefAt,
} from '../src/shared/readNextRefs.ts'

import type { BamRecord } from '@gmod/bam'
import type { Feature } from '@jbrowse/core/util'

const URL =
  'https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/data/AshkenazimTrio/HG002_NA24385_son/NIST_HiSeq_HG002_Homogeneity-10953946/NHGRI_Illumina300X_AJtrio_novoalign_bams/HG002.hs37d5.300x.bam'

const REF = process.argv[2] ?? '1'
const START = Number(process.argv[3] ?? 10_000_000)
const END = Number(process.argv[4] ?? 10_100_000)
const ROUNDS = Number(process.env.ROUNDS ?? 15)

// A config-hash-shaped id, so `readIdPrefixOf` has something realistic to strip
// — including the '-' inside it, which a naive lastIndexOf would split wrongly.
const ADAPTER_ID = 'adp--793442664'

// Stands in for `BamSlightlyLazyFeature`, spelling the same accessors the
// shipped builders read. SAM_FLAG_PAIRED is 0x1; an unpaired read has no mate
// reference, which is the -1 slot.
class Feat {
  r: BamRecord
  names: string[]
  constructor(r: BamRecord, names: string[]) {
    this.r = r
    this.names = names
  }
  id() {
    return `${ADAPTER_ID}-${this.r.fileOffset}`
  }
  get recordId() {
    return this.r.fileOffset
  }
  get nameLength() {
    return this.r.read_name_length - 1
  }
  copyNameInto(dest: Uint8Array, at: number) {
    const ba = this.r.byteArray
    const start = this.r.b0
    const len = this.r.read_name_length - 1
    for (let j = 0; j < len; j++) {
      dest[at + j] = ba[start + j]!
    }
  }
  get nextRefId() {
    return this.r.flags & 1 ? this.r.next_refid : -1
  }
  get(field: string) {
    if (field === 'name') {
      return this.r.name
    }
    if (field === 'next_ref') {
      const id = this.nextRefId
      return id >= 0 ? this.names[id] : undefined
    }
    return undefined
  }
}

const time = (fn: () => unknown) => {
  globalThis.gc?.()
  const t0 = performance.now()
  const v = fn()
  if ((v as { length?: number }).length === -1) {
    throw new Error('unreachable')
  }
  return performance.now() - t0
}

async function main() {
  if (!globalThis.gc) {
    console.error('run with --expose-gc\n')
  }
  const bam = new BamFile({
    bamFilehandle: new RemoteFile(URL),
    baiFilehandle: new RemoteFile(`${URL}.bai`),
  })
  await bam.getHeader()
  const names = (
    bam as unknown as { indexToChr: { refName: string }[] }
  ).indexToChr.map(c => c.refName)

  const t1 = performance.now()
  const records = await bam.getRecordsForRange(REF, START, END)
  const fetchS = ((performance.now() - t1) / 1000).toFixed(1)
  if (!records.length) {
    console.log(`${REF}:${START}-${END}: no records`)
    return
  }
  const feats = records.map(r => new Feat(r, names)) as unknown as Feature[]

  let maxOffset = 0
  let saCount = 0
  let nameBytes = 0
  for (const r of records) {
    if (r.fileOffset > maxOffset) {
      maxOffset = r.fileOffset
    }
    if (r.getTag('SA') !== undefined) {
      saCount++
    }
    nameBytes += r.read_name_length - 1
  }

  const prefix = readIdPrefixOf(feats)
  const buildKeys = () => {
    const out = new Float64Array(feats.length)
    for (let i = 0; i < feats.length; i++) {
      out[i] = readKeyOf(feats[i] as never) as number
    }
    return out
  }
  const oldIds = () => records.map(r => `${ADAPTER_ID}-${r.fileOffset}`)
  const oldIdsCtl = () => records.map(r => `${ADAPTER_ID}-${r.fileOffset}`)
  const oldNames = () => records.map(r => r.name)
  const oldRefs = () =>
    records.map(r => (r.flags & 1 ? (names[r.next_refid] ?? '') : ''))
  const oldSA = () => records.map(r => `${r.getTag('SA') ?? ''}`)

  // warm every arm identically before any clock starts
  const keys = buildKeys()
  const block = buildReadNameBlock(feats)
  const refs = buildReadNextRefs(feats)
  buildReadInterchrom(refs, REF, records.length)
  const wIds = oldIds()
  const wNames = oldNames()
  const wRefs = oldRefs()
  const wSA = oldSA()
  oldIdsCtl()
  structuredClone(wIds)

  // correctness over EVERY read, before any timing — an arm whose stand-in
  // stopped matching an interface would otherwise time a fallback and report a
  // fiction, which has happened twice in this directory.
  let bad = 0
  for (let i = 0; i < feats.length; i++) {
    const f = feats[i] as unknown as Feat
    if (readIdAt({ readKeys: keys, readIdPrefix: prefix }, i) !== f.id()) {
      bad++
    }
    if (readNameAt(block, i) !== f.get('name')) {
      bad++
    }
    if (nextRefAt(refs, i) !== (f.get('next_ref') ?? '')) {
      bad++
    }
  }

  const best: Record<string, number> = {}
  const arms: [string, () => unknown][] = [
    ['newKeys', buildKeys],
    ['newNames', () => buildReadNameBlock(feats)],
    ['newRefs', () => buildReadNextRefs(feats)],
    ['newInter', () => buildReadInterchrom(refs, REF, records.length)],
    ['oldIdsB', oldIds],
    ['oldIdsP', () => structuredClone(wIds)],
    ['oldNamesB', oldNames],
    ['oldNamesP', () => structuredClone(wNames)],
    ['oldRefsB', oldRefs],
    ['oldRefsP', () => structuredClone(wRefs)],
    ['oldSAB', oldSA],
    ['oldSAP', () => structuredClone(wSA)],
    ['ctl', oldIdsCtl],
  ]
  for (let round = 0; round < ROUNDS; round++) {
    for (let i = 0; i < arms.length; i++) {
      const [k, fn] = arms[(round + i) % arms.length]!
      best[k] = Math.min(best[k] ?? Infinity, time(fn))
    }
  }

  const f = (k: string) => best[k]!.toFixed(2).padStart(7)
  const was =
    best.oldIdsB! +
    best.oldIdsP! +
    best.oldNamesB! +
    best.oldNamesP! +
    best.oldRefsB! +
    best.oldRefsP! +
    best.oldSAB! +
    best.oldSAP!
  const now = best.newKeys! + best.newNames! + best.newRefs! + best.newInter!
  const wasNoSA = was - best.oldSAB! - best.oldSAP!

  console.log(
    `HG002.hs37d5.300x.bam  ${REF}:${START}-${END}  (${fetchS}s to fetch)\n` +
      `  reads                 ${records.length}\n` +
      `  name bytes/read       ${(nameBytes / records.length).toFixed(1)}\n` +
      `  max fileOffset        ${maxOffset} — over 2^32: ${maxOffset > 2 ** 32} (${(maxOffset / 2 ** 32).toFixed(0)}x)\n` +
      `  SA present            ${saCount} reads (${((100 * saCount) / records.length).toFixed(2)}%)\n` +
      `  distinct mate refs    ${refs.nextRefNames.length}\n` +
      `  prefix stripped       ${prefix === undefined ? 'undefined — STRING FALLBACK' : `"${prefix}"`}\n` +
      `  round-trip mismatches ${bad}   <- must be 0\n` +
      `\n` +
      `                          build     post\n` +
      `  readIds             ${f('oldIdsB')}  ${f('oldIdsP')}   ->  keys   ${f('newKeys')}\n` +
      `  readNames           ${f('oldNamesB')}  ${f('oldNamesP')}   ->  block  ${f('newNames')}\n` +
      `  readNextRefs        ${f('oldRefsB')}  ${f('oldRefsP')}   ->  table  ${f('newRefs')} + ${f('newInter')}\n` +
      `  readSuppAlignments  ${f('oldSAB')}  ${f('oldSAP')}   ->  not built with connections off\n` +
      `  ----------------------------------------\n` +
      `  before              ${was.toFixed(2).padStart(7)} ms   (${wasNoSA.toFixed(2)} if SA were needed anyway)\n` +
      `  after               ${now.toFixed(2).padStart(7)} ms\n` +
      `  ratio               ${(was / now).toFixed(1)}x   (${(wasNoSA / now).toFixed(1)}x)\n` +
      `  control             ${f('ctl')} ms   ${(best.oldIdsB! / best.ctl!).toFixed(3)}x  <- noise floor\n` +
      `  before, per 1k reads ${((1000 * was) / records.length).toFixed(3)} ms\n`,
  )
}

await main()
