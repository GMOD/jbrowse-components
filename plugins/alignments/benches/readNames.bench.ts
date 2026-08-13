// What does `readNames: string[]` cost, decoded and then posted?
//
//   node --expose-gc plugins/alignments/benches/readNames.bench.ts --only=1000x
//
// Flags: --rounds=<n> (default 25), --data=<dir>, --only=<fixture substring>
//
// ONE FIXTURE PER PROCESS — agent-docs/reference/BENCHMARKING.md.
//
// THE QUESTION. `readIds` is gone (shared/readIdentity.ts): the result ships a
// numeric key and builds the string where one escapes, which was 29ms a query
// on the deepest fixture. `readNames` is the array beside it and looks like the
// same shape — a string per read, structured-cloned to the main thread — but it
// is NOT the same problem, and the difference is what this bench is for:
//
//   - a QNAME has no numeric form. There is nothing to send instead of it.
//   - it is not merely copied, it is DECODED: `@gmod/bam` builds the string from
//     the record's bytes on every read of `.name`, deliberately unmemoized.
//   - the worker itself needs names in chain mode (`chainGroupingKey`) and when
//     the singleton/proper-pair filters are on. Pileup mode needs none.
//
// So there are two costs to separate, and either could be the whole thing: the
// DECODE (bam-js, per read) and the CLONE (structured clone is priced by object
// COUNT — 153,677 strings against one transferable, the same reason readIds'
// post half was 8ms).
//
// ARMS + a control, all over the same records:
//   build-str    — what ships: `r.name` per read into a string[]
//   post-str     — structuredClone of that string[] (what postMessage does)
//   build-bytes  — concatenated raw QNAME bytes + a Uint32Array of offsets,
//                  copied straight out of each record's byte array. NO decode
//                  happens at all — this is the arm that says what the decode
//                  is worth, since a pileup render reads a name only when a
//                  read is hovered
//   post-bytes   — structuredClone of those two, transferred
//   build-join   — one joined string + offsets: still decodes every name, so
//                  this isolates the clone half on its own
//   post-join    — structuredClone of that (one big string is ONE object)
//   decode-all   — every name decoded back out of the byte table, which is what
//                  a bulk consumer (arcs, chain layout) would pay on demand
//   decode-100   — 100 of them, which is nearer what a session of hovers costs
//   control      — a second, separately-declared copy of build-str
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'

import type { BamRecord } from '@gmod/bam'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '25'))
const DATA = arg('data', join(process.env.HOME!, 'src/jb2bench/data'))
const ONLY = arg('only', '')

function buildStrA(records: BamRecord[]) {
  const out: string[] = []
  for (const r of records) {
    out.push(r.name)
  }
  return out
}

function buildStrControl(records: BamRecord[]) {
  const out: string[] = []
  for (const r of records) {
    out.push(r.name)
  }
  return out
}

interface NameTable {
  bytes: Uint8Array
  offsets: Uint32Array
}

// The read name is `read_name_length` bytes at `b0`, NUL-terminated, so the
// name itself is one shorter. All three are public getters on BamRecord.
function buildBytes(records: BamRecord[]): NameTable {
  const n = records.length
  const offsets = new Uint32Array(n + 1)
  let total = 0
  for (let i = 0; i < n; i++) {
    total += records[i]!.read_name_length - 1
    offsets[i + 1] = total
  }
  const bytes = new Uint8Array(total)
  for (let i = 0; i < n; i++) {
    const r = records[i]!
    const start = r.b0
    const len = r.read_name_length - 1
    bytes.set(r.byteArray.subarray(start, start + len), offsets[i])
  }
  return { bytes, offsets }
}

// Same batch-fromCharCode shape `@gmod/bam`'s own `name` getter uses, so this
// prices the decode rather than a different way of spelling it.
function decodeAt(t: NameTable, i: number) {
  const start = t.offsets[i]!
  const end = t.offsets[i + 1]!
  const len = end - start
  const codes = new Array<number>(len)
  for (let j = 0; j < len; j++) {
    codes[j] = t.bytes[start + j]!
  }
  return String.fromCharCode(...codes)
}

function decodeAll(t: NameTable, count: number) {
  const out = new Array<string>(count)
  for (let i = 0; i < count; i++) {
    out[i] = decodeAt(t, i)
  }
  return out
}

// Same two passes, but copying the bytes by hand rather than through a
// `subarray()` per read — 153,677 subarray objects is its own cost, and the
// copy itself is only 6.4MB.
function buildBytesLoop(records: BamRecord[]): NameTable {
  const n = records.length
  const offsets = new Uint32Array(n + 1)
  let total = 0
  for (let i = 0; i < n; i++) {
    total += records[i]!.read_name_length - 1
    offsets[i + 1] = total
  }
  const bytes = new Uint8Array(total)
  for (let i = 0; i < n; i++) {
    const r = records[i]!
    const ba = r.byteArray
    const start = r.b0
    const len = r.read_name_length - 1
    const at = offsets[i]!
    for (let j = 0; j < len; j++) {
      bytes[at + j] = ba[start + j]!
    }
  }
  return { bytes, offsets }
}

// The offsets pass on its own — what walking 153,677 records and reading two
// getters off each costs, before any byte is copied. The floor for anything
// that has to visit every record.
function buildOffsetsOnly(records: BamRecord[]) {
  const n = records.length
  const offsets = new Uint32Array(n + 1)
  let total = 0
  for (let i = 0; i < n; i++) {
    total += records[i]!.read_name_length - 1
    offsets[i + 1] = total
  }
  return offsets
}

function buildJoin(records: BamRecord[]) {
  const n = records.length
  const offsets = new Uint32Array(n + 1)
  const parts = new Array<string>(n)
  let total = 0
  for (let i = 0; i < n; i++) {
    const name = records[i]!.name
    parts[i] = name
    total += name.length
    offsets[i + 1] = total
  }
  return { joined: parts.join(''), offsets }
}

// The third shape: copy the bytes, then decode them in ONE TextDecoder call
// rather than 153,677 `String.fromCharCode` calls, and ship that single string
// with the offsets. A big string is one object to clone, and V8 slices one in
// O(1) (a SlicedString, no copy) — so both a hover and a bulk consumer read a
// name for nothing, which the raw-bytes shape cannot offer.
const latin1 = new TextDecoder('latin1')
function buildBlock(records: BamRecord[]) {
  const { bytes, offsets } = buildBytesLoop(records)
  return { joined: latin1.decode(bytes), offsets }
}

// Just the decode step, over an already-built byte table, so the two halves of
// buildBlock can be told apart.
function decodeBlockOnly(t: NameTable) {
  return latin1.decode(t.bytes)
}

function sliceAll(
  block: { joined: string; offsets: Uint32Array },
  count: number,
) {
  const out = new Array<string>(count)
  for (let i = 0; i < count; i++) {
    out[i] = block.joined.slice(block.offsets[i], block.offsets[i + 1])
  }
  return out
}

// What a bulk consumer actually does with the names: `groupReadsByName` (arcs
// and the linked-read overlay both) keys a Map by them. That matters because a
// V8 SlicedString has to be FLATTENED to be hashed, so grouping out of the block
// pays a copy that grouping out of a string[] does not — and the slice arm above
// would flatter the block shape if this were left unmeasured.
function groupByName(names: string[]) {
  const m = new Map<string, number[]>()
  for (let i = 0; i < names.length; i++) {
    const name = names[i]!
    const cur = m.get(name)
    if (cur) {
      cur.push(i)
    } else {
      m.set(name, [i])
    }
  }
  return m
}

function groupFromBlock(
  block: { joined: string; offsets: Uint32Array },
  count: number,
) {
  const m = new Map<string, number[]>()
  for (let i = 0; i < count; i++) {
    const name = block.joined.slice(block.offsets[i], block.offsets[i + 1])
    const cur = m.get(name)
    if (cur) {
      cur.push(i)
    } else {
      m.set(name, [i])
    }
  }
  return m
}

// The join step alone, over names already in hand — what a source with no raw
// bytes (CRAM, SAM, PAF) would pay to build the block.
function joinOnly(names: string[]) {
  const n = names.length
  const offsets = new Uint32Array(n + 1)
  let total = 0
  for (let i = 0; i < n; i++) {
    total += names[i]!.length
    offsets[i + 1] = total
  }
  return { joined: names.join(''), offsets }
}

const time = (fn: () => unknown) => {
  globalThis.gc?.()
  const t0 = performance.now()
  const v = fn()
  const t = performance.now() - t0
  // keep the result alive past the clock so nothing is optimized out
  if ((v as { length?: number }).length === -1) {
    throw new Error('unreachable')
  }
  return t
}

async function main() {
  if (!globalThis.gc) {
    console.error('run with --expose-gc\n')
  }
  const files = [
    { file: '1000x.shortread.bam', ref: 'chr22_mask', s: 124000, e: 143000 },
    { file: '200x.shortread.bam', ref: 'chr22_mask', s: 124000, e: 143000 },
    { file: '200x.longread.bam', ref: 'chr22_mask', s: 124000, e: 143000 },
  ].filter(f => f.file.includes(ONLY))

  for (const { file, ref, s, e } of files) {
    const path = join(DATA, file)
    try {
      readFileSync(path, { flag: 'r' })
    } catch {
      console.log(`${file}: absent, skipped`)
      continue
    }
    const bam = new BamFile({ bamPath: path, baiPath: `${path}.bai` })
    await bam.getHeader()
    const records = await bam.getRecordsForRange(ref, s, e)
    if (!records.length) {
      continue
    }

    // warm every arm identically
    const strs = buildStrA(records)
    buildStrControl(records)
    const table = buildBytes(records)
    const joined = buildJoin(records)
    const block = buildBlock(records)
    sliceAll(block, 100)
    structuredClone(strs)
    decodeAll(table, 100)

    const best = {
      bstr: Infinity,
      pstr: Infinity,
      bbytes: Infinity,
      bloop: Infinity,
      boff: Infinity,
      bblock: Infinity,
      bdec: Infinity,
      pblock: Infinity,
      sall: Infinity,
      s100: Infinity,
      gstr: Infinity,
      gblk: Infinity,
      jonly: Infinity,
      pbytes: Infinity,
      bjoin: Infinity,
      pjoin: Infinity,
      dall: Infinity,
      d100: Infinity,
      ctl: Infinity,
    }
    const sides = [
      { k: 'bstr' as const, run: () => buildStrA(records) },
      { k: 'pstr' as const, run: () => structuredClone(strs) },
      { k: 'bbytes' as const, run: () => buildBytes(records) },
      {
        // transferred, which is what collectTransferables does for every typed
        // array in the result. A fresh copy each round, since transferring
        // detaches the source.
        k: 'pbytes' as const,
        run: () => {
          const b = table.bytes.slice()
          const o = table.offsets.slice()
          return structuredClone({ b, o }, { transfer: [b.buffer, o.buffer] })
        },
      },
      { k: 'bloop' as const, run: () => buildBytesLoop(records) },
      { k: 'boff' as const, run: () => buildOffsetsOnly(records) },
      { k: 'bblock' as const, run: () => buildBlock(records) },
      { k: 'bdec' as const, run: () => decodeBlockOnly(table) },
      {
        k: 'pblock' as const,
        run: () => {
          const o = block.offsets.slice()
          return structuredClone(
            { s: block.joined, o },
            { transfer: [o.buffer] },
          )
        },
      },
      { k: 'sall' as const, run: () => sliceAll(block, records.length) },
      { k: 's100' as const, run: () => sliceAll(block, 100) },
      { k: 'gstr' as const, run: () => groupByName(strs) },
      { k: 'gblk' as const, run: () => groupFromBlock(block, records.length) },
      { k: 'jonly' as const, run: () => joinOnly(strs) },
      { k: 'bjoin' as const, run: () => buildJoin(records) },
      {
        k: 'pjoin' as const,
        run: () => {
          const o = joined.offsets.slice()
          return structuredClone(
            { s: joined.joined, o },
            { transfer: [o.buffer] },
          )
        },
      },
      { k: 'dall' as const, run: () => decodeAll(table, records.length) },
      { k: 'd100' as const, run: () => decodeAll(table, 100) },
      { k: 'ctl' as const, run: () => buildStrControl(records) },
    ]
    for (let round = 0; round < ROUNDS; round++) {
      for (let i = 0; i < sides.length; i++) {
        const side = sides[(round + i) % sides.length]!
        best[side.k] = Math.min(best[side.k], time(side.run))
      }
    }
    const n = records.length
    const nameBytes = table.bytes.length
    console.log(
      `${file}  ${n} reads, ${nameBytes} name bytes (${(nameBytes / n).toFixed(1)}/read)\n` +
        `  build string[]   ${best.bstr.toFixed(2).padStart(8)} ms\n` +
        `  build bytes      ${best.bbytes.toFixed(2).padStart(8)} ms   ${(best.bstr / best.bbytes).toFixed(1)}x\n` +
        `  build bytes-loop ${best.bloop.toFixed(2).padStart(8)} ms   ${(best.bstr / best.bloop).toFixed(1)}x\n` +
        `  build offsets    ${best.boff.toFixed(2).padStart(8)} ms   <- record walk alone, no bytes copied\n` +
        `  build block      ${best.bblock.toFixed(2).padStart(8)} ms   ${(best.bstr / best.bblock).toFixed(1)}x  (bytes + 1 TextDecoder: ${best.bdec.toFixed(2)} ms)\n` +
        `  post  block      ${best.pblock.toFixed(2).padStart(8)} ms   ${(best.pstr / best.pblock).toFixed(1)}x\n` +
        `  build joined     ${best.bjoin.toFixed(2).padStart(8)} ms   ${(best.bstr / best.bjoin).toFixed(1)}x\n` +
        `  post  string[]   ${best.pstr.toFixed(2).padStart(8)} ms\n` +
        `  post  bytes      ${best.pbytes.toFixed(2).padStart(8)} ms   ${(best.pstr / best.pbytes).toFixed(1)}x\n` +
        `  post  joined     ${best.pjoin.toFixed(2).padStart(8)} ms   ${(best.pstr / best.pjoin).toFixed(1)}x\n` +
        `  --------------------------------\n` +
        `  total  ships     ${(best.bstr + best.pstr).toFixed(2).padStart(8)} ms\n` +
        `  total  bytes     ${(best.bbytes + best.pbytes).toFixed(2).padStart(8)} ms   ` +
        `${((best.bstr + best.pstr) / (best.bbytes + best.pbytes)).toFixed(1)}x\n` +
        `  total  bytes-loop${(best.bloop + best.pbytes).toFixed(2).padStart(8)} ms   ` +
        `${((best.bstr + best.pstr) / (best.bloop + best.pbytes)).toFixed(1)}x\n` +
        `  total  block     ${(best.bblock + best.pblock).toFixed(2).padStart(8)} ms   ` +
        `${((best.bstr + best.pstr) / (best.bblock + best.pblock)).toFixed(1)}x\n` +
        `  total  joined    ${(best.bjoin + best.pjoin).toFixed(2).padStart(8)} ms   ` +
        `${((best.bstr + best.pstr) / (best.bjoin + best.pjoin)).toFixed(1)}x\n` +
        `  --------------------------------\n` +
        `  decode all       ${best.dall.toFixed(2).padStart(8)} ms   <- what a bulk consumer pays on demand\n` +
        `  decode 100       ${best.d100.toFixed(2).padStart(8)} ms   <- nearer a session of hovers\n` +
        `  slice all        ${best.sall.toFixed(2).padStart(8)} ms   <- the same, out of the block\n` +
        `  slice 100        ${best.s100.toFixed(2).padStart(8)} ms\n` +
        `  groupByName str  ${best.gstr.toFixed(2).padStart(8)} ms   <- what arcs/linked reads do today\n` +
        `  groupByName blk  ${best.gblk.toFixed(2).padStart(8)} ms   ${(best.gstr / best.gblk).toFixed(2)}x\n` +
        `  join only        ${best.jonly.toFixed(2).padStart(8)} ms   <- a source with no raw bytes builds the block this way\n` +
        `  control          ${best.ctl.toFixed(2).padStart(8)} ms   ${(best.bstr / best.ctl).toFixed(3)}x  <- noise floor\n`,
    )
  }
}

await main()
