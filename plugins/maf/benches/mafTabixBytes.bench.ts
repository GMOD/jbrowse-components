// A/B the MAF-tabix read path: the string route that ships today against a
// byte-native one built on @gmod/tabix's proposed `lineBytesCallback`
// (GMOD/tabix-js#156), from the bgzf block to a finished `MafWirePacked`.
//
//   TABIX_PR_SRC=<tabix-js checkout with #156> \
//     node plugins/maf/benches/runBundled.ts plugins/maf/benches/mafTabixBytes.bench.ts
//
// Flags: --rounds=<n> (default 12), --only=<arm>, --allow-diff, --dir=<fixture dir>,
//        --blocks/--species/--columns/--spacing to change the fixture's shape
//
// FIVE ARMS, because "byte-native" is two changes and the PR only enables one:
//
//   bed+string  what ships: BedTabixAdapter builds a SimpleFeature per line,
//               MafTabixAdapter scans column 6 out of it, the RPC buffers every
//               block and packs in a second pass with `encodeInto`.
//   string      the same minus the BedTabixAdapter layer — a direct tabix read
//               that slices column 6 off the line itself. Reachable TODAY, with
//               no tabix change at all.
//   string-1p   the same strings, packed inside the callback instead of being
//               buffered — the restructure the byte arm is FORCED into, on its
//               own. No tabix change.
//   bytes       `lineBytesCallback`: no decode, no column-6 substring, no
//               per-row `seq` string, and the arena written straight from the
//               bgzf buffer. Necessarily one pass, so the arena grows by
//               doubling instead of being reserved — that cost is charged here.
//   control     a byte-identical copy of `string`, separately declared.
//
// So `bytes` vs `string-1p` is what #156 is worth, `string-1p` vs `string` is
// what the restructure is worth without it, and `string` vs `bed+string` is the
// BedTabixAdapter layer. Quoting `bytes` against `bed+string` would credit the
// PR with all three.
//
// What it reported (2026-08-16, min of 30-40 interleaved rounds, control within
// 3% of 1.00 on every row; see reference/MAF_WORKER_PIPELINE.md):
//
//   shape                        bed+str  string  string-1p  bytes   peak RSS
//   1600 blocks x 250 columns      0.92    1.00     0.97      1.17   256/207/205 MB
//   20000 blocks x 8 columns       0.94    1.00     1.18      1.17   491/263/265 MB
//
// The second shape is the real one — MAF_LARGE_BLOCKS.md measures ce11's 26-way
// at a 7bp median block — and there the byte arm does not beat the restructure
// it is confused with. Both memory columns belong to the restructure too.
//
// Everything reference/BENCHMARKING.md asks for: arms interleaved round-robin in
// one process, min across rounds, a control arm, an identity check over every
// packed column before any timing is believed, and the emitted counts printed
// per row so a fixture that produces nothing cannot pass silently. The drivers
// are written out longhand — the duplication between `string` and `control` is
// deliberate, and so is the duplication between the two string arms.
import { TabixIndexedFile } from '@gmod/tabix-pr'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { DEFAULT_SPEC, ensureMafTabixFixture } from './mafTabixFixture.ts'
import { featureData, makeParser } from '../../bed/src/util.ts'
import { MafWirePacker } from '../src/LinearMafGetAlignmentDataRpc/mafWirePacker.ts'
import {
  columnRange,
  makeByteSourceResolver,
  scanMafTabixEntryBytes,
} from './mafTabixBytes.ts'
import {
  makeSourceResolver,
  scanMafTabixEntry,
  selectReferenceSequenceString,
} from '../src/util/parseAssemblyName.ts'

import type { MafWirePacked } from '../src/LinearMafGetAlignmentDataRpc/mafWirePacker.ts'

const REF_ASSEMBLY = 'sp0'
const COMMA = 44

const rounds = Number(
  process.argv.find(a => a.startsWith('--rounds='))?.slice(9) ?? 12,
)
const only = process.argv.find(a => a.startsWith('--only='))?.slice(7)
const allowDiff = process.argv.includes('--allow-diff')
const fixtureDir = process.argv.find(a => a.startsWith('--dir='))?.slice(6)

// One shape per process, deliberately: BENCHMARKING.md's "looping several
// DATASETS through the same arm function objects" is the trap this avoids, and
// it reversed a ratio by 1.7x when it bit. Quote the shapes from separate runs.
function flag(name: string, fallback: number) {
  const raw = process.argv.find(a => a.startsWith(`--${name}=`))
  return raw ? Number(raw.slice(name.length + 3)) : fallback
}

const fixture = ensureMafTabixFixture(fixtureDir, {
  ...DEFAULT_SPEC,
  blocks: flag('blocks', DEFAULT_SPEC.blocks),
  species: flag('species', DEFAULT_SPEC.species),
  columns: flag('columns', DEFAULT_SPEC.columns),
  spacing: flag('spacing', DEFAULT_SPEC.spacing),
})
const parser = makeParser({ columnNames: [] })

interface StringAlign {
  chr: string
  start: number
  strand: number
  srcSize: number | undefined
  seq: string
}

interface ByteAlign {
  chr: string
  start: number
  strand: number
  srcSize: number | undefined
  seqStart: number
  seqEnd: number
}

function openFile() {
  return new TabixIndexedFile({
    path: fixture.bedGzPath,
    tbiPath: fixture.tbiPath,
  })
}

type TabixFile = ReturnType<typeof openFile>

// ARM 1: what ships today — BedTabixAdapter's per-line SimpleFeature, then
// MafTabixAdapter's scan of column 6, then the RPC's buffer-then-pack.
async function runBedString(file: TabixFile): Promise<MafWirePacked> {
  const resolver = makeSourceResolver()
  const reserve = { blocks: 0, rows: 0, empties: 0, bytes: 0 }
  const rawBlocks: {
    startBp: number
    refSeq: string
    alignments: Record<string, StringAlign>
  }[] = []
  await file.getLines(fixture.refName, fixture.start, fixture.end, {
    lineCallback: (line: string, fileOffset: number, s: number, e: number) => {
      const splitLine = line.split('\t')
      const feature = new SimpleFeature(
        featureData({
          splitLine,
          refName: fixture.refName,
          start: s,
          end: e,
          parser,
          uniqueId: `bed-${fileOffset}`,
          scoreColumn: '',
        }),
      )
      const encoded = feature.get('field5') as string
      const alignments: Record<string, StringAlign> = {}
      let firstAssemblyNameFound: string | undefined
      for (let from = 0, l = encoded.length; from < l;) {
        let to = encoded.indexOf(',', from)
        if (to === -1) {
          to = l
        }
        const entry = scanMafTabixEntry(encoded, from, to, resolver.resolve)
        if (entry) {
          firstAssemblyNameFound ??= entry.assemblyName
          alignments[entry.assemblyName] = {
            chr: entry.chr,
            start: entry.start,
            strand: entry.strand,
            srcSize: entry.srcSize,
            seq: entry.seq,
          }
        }
        from = to + 1
      }
      const refSeq =
        selectReferenceSequenceString(
          alignments,
          REF_ASSEMBLY,
          undefined,
          firstAssemblyNameFound,
        ) ?? ''
      reserve.blocks++
      reserve.bytes += refSeq.length
      for (const id in alignments) {
        reserve.rows++
        reserve.bytes += alignments[id]!.seq.length
      }
      rawBlocks.push({
        startBp: feature.get('start') as number,
        refSeq,
        alignments,
      })
    },
  })
  const packer = new MafWirePacker(reserve)
  for (const { startBp, refSeq, alignments } of rawBlocks) {
    packer.startBlock(startBp, refSeq)
    for (const id in alignments) {
      const a = alignments[id]!
      packer.addRow({
        sampleId: id,
        seq: a.seq,
        chr: a.chr,
        start: a.start,
        strand: a.strand,
        srcSize: a.srcSize,
      })
    }
  }
  return packer.finishBlocks()
}

// ARM 2: the same work without the BedTabixAdapter layer — column 6 comes off
// the line directly. Available today; no tabix change involved.
async function runDirectString(file: TabixFile): Promise<MafWirePacked> {
  const resolver = makeSourceResolver()
  const reserve = { blocks: 0, rows: 0, empties: 0, bytes: 0 }
  const rawBlocks: {
    startBp: number
    refSeq: string
    alignments: Record<string, StringAlign>
  }[] = []
  await file.getLines(fixture.refName, fixture.start, fixture.end, {
    lineCallback: (line: string, _fileOffset: number, s: number) => {
      let cut = -1
      for (let i = 0; i < 5; i++) {
        cut = line.indexOf('\t', cut + 1)
      }
      const encoded = line.slice(cut + 1)
      const alignments: Record<string, StringAlign> = {}
      let firstAssemblyNameFound: string | undefined
      for (let from = 0, l = encoded.length; from < l;) {
        let to = encoded.indexOf(',', from)
        if (to === -1) {
          to = l
        }
        const entry = scanMafTabixEntry(encoded, from, to, resolver.resolve)
        if (entry) {
          firstAssemblyNameFound ??= entry.assemblyName
          alignments[entry.assemblyName] = {
            chr: entry.chr,
            start: entry.start,
            strand: entry.strand,
            srcSize: entry.srcSize,
            seq: entry.seq,
          }
        }
        from = to + 1
      }
      const refSeq =
        selectReferenceSequenceString(
          alignments,
          REF_ASSEMBLY,
          undefined,
          firstAssemblyNameFound,
        ) ?? ''
      reserve.blocks++
      reserve.bytes += refSeq.length
      for (const id in alignments) {
        reserve.rows++
        reserve.bytes += alignments[id]!.seq.length
      }
      rawBlocks.push({ startBp: s, refSeq, alignments })
    },
  })
  const packer = new MafWirePacker(reserve)
  for (const { startBp, refSeq, alignments } of rawBlocks) {
    packer.startBlock(startBp, refSeq)
    for (const id in alignments) {
      const a = alignments[id]!
      packer.addRow({
        sampleId: id,
        seq: a.seq,
        chr: a.chr,
        start: a.start,
        strand: a.strand,
        srcSize: a.srcSize,
      })
    }
  }
  return packer.finishBlocks()
}

// ARM 3: strings, but packed inside the callback like the byte arm — no
// buffered blocks, and the same unreserved arena growing by doubling.
//
// This arm exists because the byte arm changes two things at once. Being unable
// to keep the buffer past the call forces the single pass, and the single pass
// is what stops 41,600 `seq` strings being retained until packing — so without
// this arm every megabyte and every millisecond the restructure is worth would
// be credited to the byte handoff. Nothing here needs a tabix change.
async function runDirectStringOnePass(file: TabixFile): Promise<MafWirePacked> {
  const resolver = makeSourceResolver()
  const packer = new MafWirePacker()
  await file.getLines(fixture.refName, fixture.start, fixture.end, {
    lineCallback: (line: string, _fileOffset: number, s: number) => {
      let cut = -1
      for (let i = 0; i < 5; i++) {
        cut = line.indexOf('\t', cut + 1)
      }
      const encoded = line.slice(cut + 1)
      const alignments: Record<string, StringAlign> = {}
      let firstAssemblyNameFound: string | undefined
      for (let from = 0, l = encoded.length; from < l;) {
        let to = encoded.indexOf(',', from)
        if (to === -1) {
          to = l
        }
        const entry = scanMafTabixEntry(encoded, from, to, resolver.resolve)
        if (entry) {
          firstAssemblyNameFound ??= entry.assemblyName
          alignments[entry.assemblyName] = {
            chr: entry.chr,
            start: entry.start,
            strand: entry.strand,
            srcSize: entry.srcSize,
            seq: entry.seq,
          }
        }
        from = to + 1
      }
      const refSeq =
        selectReferenceSequenceString(
          alignments,
          REF_ASSEMBLY,
          undefined,
          firstAssemblyNameFound,
        ) ?? ''
      packer.startBlock(s, refSeq)
      for (const id in alignments) {
        const a = alignments[id]!
        packer.addRow({
          sampleId: id,
          seq: a.seq,
          chr: a.chr,
          start: a.start,
          strand: a.strand,
          srcSize: a.srcSize,
        })
      }
    },
  })
  return packer.finishBlocks()
}

// ARM 4: byte-native. The bgzf buffer is only valid for the duration of the
// call, so the block is packed inside the callback rather than buffered — which
// is also why this arm cannot reserve the arena and pays for growing it.
async function runBytes(file: TabixFile): Promise<MafWirePacked> {
  const resolve = makeByteSourceResolver(makeSourceResolver().resolve)
  const packer = new MafWirePacker()
  await file.getLines(fixture.refName, fixture.start, fixture.end, {
    lineBytesCallback: (
      buffer: Uint8Array,
      lineStart: number,
      lineEnd: number,
      _fileOffset: number,
      s: number,
    ) => {
      const column = columnRange(buffer, lineStart, lineEnd, 5)
      if (!column) {
        return
      }
      const alignments: Record<string, ByteAlign> = {}
      let firstAssemblyNameFound: string | undefined
      for (let from = column.start; from < column.end;) {
        let to = buffer.indexOf(COMMA, from)
        if (to === -1 || to > column.end) {
          to = column.end
        }
        const entry = scanMafTabixEntryBytes(buffer, from, to, resolve)
        if (entry) {
          firstAssemblyNameFound ??= entry.assemblyName
          alignments[entry.assemblyName] = {
            chr: entry.chr,
            start: entry.start,
            strand: entry.strand,
            srcSize: entry.srcSize,
            seqStart: entry.seqStart,
            seqEnd: entry.seqEnd,
          }
        }
        from = to + 1
      }
      const ref =
        alignments[REF_ASSEMBLY] ??
        (firstAssemblyNameFound
          ? alignments[firstAssemblyNameFound]
          : undefined)
      packer.startBlock(
        s,
        ref ? buffer.subarray(ref.seqStart, ref.seqEnd) : new Uint8Array(0),
      )
      for (const id in alignments) {
        const a = alignments[id]!
        packer.addRow({
          sampleId: id,
          seq: buffer.subarray(a.seqStart, a.seqEnd),
          chr: a.chr,
          start: a.start,
          strand: a.strand,
          srcSize: a.srcSize,
        })
      }
    },
  })
  return packer.finishBlocks()
}

// ARM 5: the control. Byte-identical to `runDirectString`, declared separately
// so it gets its own inline caches — whatever this scores against arm 2 is the
// harness's own floor, and no ratio below is believable unless it clears that.
async function runControlString(file: TabixFile): Promise<MafWirePacked> {
  const resolver = makeSourceResolver()
  const reserve = { blocks: 0, rows: 0, empties: 0, bytes: 0 }
  const rawBlocks: {
    startBp: number
    refSeq: string
    alignments: Record<string, StringAlign>
  }[] = []
  await file.getLines(fixture.refName, fixture.start, fixture.end, {
    lineCallback: (line: string, _fileOffset: number, s: number) => {
      let cut = -1
      for (let i = 0; i < 5; i++) {
        cut = line.indexOf('\t', cut + 1)
      }
      const encoded = line.slice(cut + 1)
      const alignments: Record<string, StringAlign> = {}
      let firstAssemblyNameFound: string | undefined
      for (let from = 0, l = encoded.length; from < l;) {
        let to = encoded.indexOf(',', from)
        if (to === -1) {
          to = l
        }
        const entry = scanMafTabixEntry(encoded, from, to, resolver.resolve)
        if (entry) {
          firstAssemblyNameFound ??= entry.assemblyName
          alignments[entry.assemblyName] = {
            chr: entry.chr,
            start: entry.start,
            strand: entry.strand,
            srcSize: entry.srcSize,
            seq: entry.seq,
          }
        }
        from = to + 1
      }
      const refSeq =
        selectReferenceSequenceString(
          alignments,
          REF_ASSEMBLY,
          undefined,
          firstAssemblyNameFound,
        ) ?? ''
      reserve.blocks++
      reserve.bytes += refSeq.length
      for (const id in alignments) {
        reserve.rows++
        reserve.bytes += alignments[id]!.seq.length
      }
      rawBlocks.push({ startBp: s, refSeq, alignments })
    },
  })
  const packer = new MafWirePacker(reserve)
  for (const { startBp, refSeq, alignments } of rawBlocks) {
    packer.startBlock(startBp, refSeq)
    for (const id in alignments) {
      const a = alignments[id]!
      packer.addRow({
        sampleId: id,
        seq: a.seq,
        chr: a.chr,
        start: a.start,
        strand: a.strand,
        srcSize: a.srcSize,
      })
    }
  }
  return packer.finishBlocks()
}

function describeDiff(a: MafWirePacked, b: MafWirePacked) {
  if (a.arena.length !== b.arena.length) {
    return `arena length ${a.arena.length} vs ${b.arena.length}`
  }
  for (let i = 0; i < a.arena.length; i++) {
    if (a.arena[i] !== b.arena[i]) {
      return `arena[${i}] ${a.arena[i]} vs ${b.arena[i]}`
    }
  }
  const columns = [
    'rowOffset',
    'rowLength',
    'rowSample',
    'rowChr',
    'rowStart',
    'rowStrand',
    'rowSrcSize',
    'blockStartBp',
    'blockEndBp',
    'blockRefOffset',
    'blockRefLength',
    'blockRowStart',
  ] as const
  for (const name of columns) {
    const x = a[name]
    const y = b[name]
    if (x.length !== y.length) {
      return `${name} length ${x.length} vs ${y.length}`
    }
    for (let i = 0; i < x.length; i++) {
      if (x[i] !== y[i]) {
        return `${name}[${i}] ${x[i]} vs ${y[i]}`
      }
    }
  }
  if (a.sampleIds.join(',') !== b.sampleIds.join(',')) {
    return `sampleIds ${a.sampleIds.join(',')} vs ${b.sampleIds.join(',')}`
  }
  if (a.chrNames.join(',') !== b.chrNames.join(',')) {
    return `chrNames ${a.chrNames.join(',')} vs ${b.chrNames.join(',')}`
  }
  return undefined
}

const arms = [
  { name: 'bed+string', run: runBedString, file: openFile() },
  { name: 'string', run: runDirectString, file: openFile() },
  { name: 'string-1p', run: runDirectStringOnePass, file: openFile() },
  { name: 'bytes', run: runBytes, file: openFile() },
  { name: 'control', run: runControlString, file: openFile() },
].filter(arm => !only || arm.name === only)

// The cold call runs the arm under --only, not a fixed one: reaching the packer
// with a string first would leave its `write` polymorphic before the byte arm
// ever runs, which is exactly what --only exists to rule out.
const coldArm = arms[0]!
const cold = performance.now()
const coldPacked = await coldArm.run(openFile())
const coldMs = performance.now() - cold
console.log(
  `fixture ${fixture.bedGzPath}\ncold read+parse+pack (${coldArm.name} arm, one call): ${coldMs.toFixed(1)}ms`,
)
console.log(
  `emitted: ${coldPacked.blockStartBp.length} blocks, ${coldPacked.rowOffset.length} rows, ${coldPacked.arena.length} arena bytes\n`,
)

// The identity pass doubles as warmup, and every arm gets exactly the same one:
// an arm warmed differently from its neighbour has been worth 39% on its own.
const identity = new Map<string, MafWirePacked>()
for (const arm of arms) {
  identity.set(arm.name, await arm.run(arm.file))
}
const baseline = identity.get(arms[0]!.name)!
for (const arm of arms.slice(1)) {
  const diff = describeDiff(baseline, identity.get(arm.name)!)
  if (diff) {
    console.error(
      `IDENTITY: ${arm.name} differs from ${arms[0]!.name}: ${diff}`,
    )
    if (!allowDiff) {
      process.exit(1)
    }
  }
}

const times = new Map(arms.map(arm => [arm.name, [] as number[]]))
for (let round = 0; round < rounds; round++) {
  // rotated as well as interleaved: whichever arm runs first in a round pays
  // for the round's own cold start, and a fixed order hands that to the same
  // arm every time. Visible here as the control drifting off 1.00.
  const order = arms.map((_, i) => arms[(i + round) % arms.length]!)
  for (const arm of order) {
    globalThis.gc?.()
    const t0 = performance.now()
    await arm.run(arm.file)
    times.get(arm.name)!.push(performance.now() - t0)
  }
}

const mins = new Map(
  [...times].map(([name, ts]) => [name, Math.min(...ts)] as const),
)
const base = mins.get('string') ?? mins.get(arms[0]!.name)!
console.log(
  `warm, min of ${rounds} interleaved rounds (ratio vs the 'string' arm):\n`,
)
for (const arm of arms) {
  const ms = mins.get(arm.name)!
  const packed = identity.get(arm.name)!
  console.log(
    `  ${arm.name.padEnd(11)} ${ms.toFixed(1).padStart(7)}ms  ${(base / ms).toFixed(3)}x` +
      `   [${times
        .get(arm.name)!
        .map(t => t.toFixed(0))
        .join(' ')}]` +
      `  (${packed.blockStartBp.length} blocks, ${packed.rowOffset.length} rows, ${packed.arena.length} bytes)`,
  )
}

if (only) {
  console.log(
    `\npeak RSS for --only=${only}: ${(process.resourceUsage().maxRSS / 1024).toFixed(0)} MB`,
  )
}
