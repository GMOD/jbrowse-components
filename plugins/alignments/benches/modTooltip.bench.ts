// What does the coverage tooltip's per-position modification data cost to build
// and to post?
//
//   node --expose-gc plugins/alignments/benches/modTooltip.bench.ts
//
// Flags: --rounds=<n> (default 15), --only=<fixture substring>, --allow-diff
//
// The harness rules — interleave, min-of-rounds, run a control, check identity
// before believing timing — are in `agent-docs/reference/BENCHMARKING.md`.
//
// THE QUESTION, and why it has two halves. This structure is built in the RPC
// worker over every modification call in the region, and read at exactly ONE
// position, when someone hovers the coverage band. As a
// `Record<number, ModTooltipEntry[]>` that is an object per (position, modType)
// with two freshly-built strings on it — and then it crosses to the main thread,
// where structured clone is priced by object COUNT (the same reason `readKeys`
// and `readNameBlock` exist). So:
//
//   build — CPU in the worker to construct it
//   post  — `structuredClone`, which is what `postMessage` does
//
// A fix that removes one half and not the other buys half, so both are timed.
// The flat form is transferable, so its "post" is a floor rather than a cost.
//
// ARMS:
//   build-record / post-record   what shipped before
//   build-flat / post-flat       the CSR-style typed arrays that ship now
//   hover-flat                   one position read back out, which is the whole
//                                of what either shape is FOR
//   control                      a second, separately-declared copy of
//                                build-record. A row whose control is far from
//                                1.00 measured nothing.
//
// SYNTHETIC FIXTURES sized like methylation data: a call per cytosine over the
// window, at the depth given, with the mod/no-mod split a real sample has.
//
// ---------------------------------------------------------------------------
// WHAT IT SAYS. Two samples, --rounds=15, ~848k calls either way, control in
// brackets:
//
//   meth-100kb-40x   21193 positions   build  3.19x [1.00], 2.88x [1.04]
//                                             263 -> 82 ms, 497 -> 173 ms
//                                      post    213x,  201x
//                                             61 -> 0.3 ms, 109 -> 0.5 ms
//   meth-20kb-200x    4243 positions   build  3.44x [0.99], 3.34x [1.01]
//                                      post    124x,  132x
//
//   hover-flat, 200 hovers: 0.10-0.20 ms, both fixtures
//
// The build is ~3x for having dropped a template string per call — which is the
// change `features/modCoverage/compute.ts` already made beside it — but the POST
// column is why the shape changed rather than only the key. It was the larger
// number of the two and it goes to nothing, because six typed arrays are
// transferred where ~100k objects with two strings apiece were copied. Together
// that is ~320ms -> ~82ms per fetch, per track, on a methylation pileup.
//
// `structuredClone` here stands in for `postMessage` and does NOT transfer,
// which is the honest comparison for the record arm and a slight overstatement
// of the flat arm's cost: the worker transfers those buffers, so the shipped
// post is lower than 0.3ms, not higher.
//
// `hover-flat` is there to show the read side did not pay for it — a binary
// search and a handful of objects, for the one position a hover asks about.

import {
  abgrBlue,
  abgrGreen,
  abgrRed,
} from '../../../packages/core/src/util/colorBits.ts'
import {
  buildModTooltipIndex,
  modTooltipEntriesAt,
} from '../src/shared/modTooltipIndex.ts'
import { getModificationName } from '../src/shared/modificationData.ts'

import type { ModificationEntry } from '../src/shared/webglRpcTypes.ts'

const arg = (name: string, dflt: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? dflt

const ROUNDS = Number(arg('rounds', '15'))
const ONLY = arg('only', '')
const ALLOW_DIFF = process.argv.includes('--allow-diff')

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const ABGR_5MC = 0xff0000ff
const ABGR_UNMOD = 0xff888888

// BASELINE. The Record shape, with the `${position}_${modType}_${noMod}_${color}`
// template string per call. Transcribed from the deleted shared/buildTooltipData.ts.
const buildRecord = (
  modifications: ModificationEntry[],
  regionStart: number,
) => {
  const result: Record<number, unknown[]> = {}
  const seen = new Map<
    string,
    {
      count: number
      fwd: number
      rev: number
      probabilityTotal: number
      color: string
      name: string
    }
  >()
  for (const mod of modifications) {
    if (mod.position < regionStart) {
      continue
    }
    const modKey = `${mod.position}_${mod.modType}_${mod.noMod ? 'n' : 'm'}_${mod.color}`
    let entry = seen.get(modKey)
    if (!entry) {
      entry = {
        count: 0,
        fwd: 0,
        rev: 0,
        probabilityTotal: 0,
        color: `rgb(${abgrRed(mod.color)},${abgrGreen(mod.color)},${abgrBlue(mod.color)})`,
        name: mod.noMod
          ? `Unmodified ${mod.base}`
          : getModificationName(mod.modType),
      }
      seen.set(modKey, entry)
      ;(result[mod.position] ??= []).push(entry)
    }
    entry.count++
    entry.probabilityTotal += mod.prob
    if (mod.strand === 1) {
      entry.fwd++
    } else {
      entry.rev++
    }
  }
  return result
}

// CONTROL. Byte-identical to buildRecord, separate literal on purpose.
const buildControl = (
  modifications: ModificationEntry[],
  regionStart: number,
) => {
  const result: Record<number, unknown[]> = {}
  const seen = new Map<
    string,
    {
      count: number
      fwd: number
      rev: number
      probabilityTotal: number
      color: string
      name: string
    }
  >()
  for (const mod of modifications) {
    if (mod.position < regionStart) {
      continue
    }
    const modKey = `${mod.position}_${mod.modType}_${mod.noMod ? 'n' : 'm'}_${mod.color}`
    let entry = seen.get(modKey)
    if (!entry) {
      entry = {
        count: 0,
        fwd: 0,
        rev: 0,
        probabilityTotal: 0,
        color: `rgb(${abgrRed(mod.color)},${abgrGreen(mod.color)},${abgrBlue(mod.color)})`,
        name: mod.noMod
          ? `Unmodified ${mod.base}`
          : getModificationName(mod.modType),
      }
      seen.set(modKey, entry)
      ;(result[mod.position] ??= []).push(entry)
    }
    entry.count++
    entry.probabilityTotal += mod.prob
    if (mod.strand === 1) {
      entry.fwd++
    } else {
      entry.rev++
    }
  }
  return result
}

declare const gc: (() => void) | undefined

function checkIdentity(
  name: string,
  record: Record<number, unknown[]>,
  index: ReturnType<typeof buildModTooltipIndex>,
) {
  const fail = (msg: string) => {
    console.error(`  IDENTITY FAIL (${name}): ${msg}`)
    if (!ALLOW_DIFF) {
      process.exit(1)
    }
  }
  const positions = Object.keys(record).map(Number)
  if (!index) {
    fail('flat index is undefined')
    return
  }
  if (positions.length !== index.modTooltipPositions.length) {
    fail(
      `position count ${positions.length} vs ${index.modTooltipPositions.length}`,
    )
    return
  }
  for (const position of positions) {
    const want = record[position] as {
      count: number
      fwd: number
      rev: number
      probabilityTotal: number
      color: string
      name: string
    }[]
    const got = modTooltipEntriesAt(index, position)
    if (!got || got.length !== want.length) {
      fail(`position ${position}: ${want.length} entries vs ${got?.length}`)
      return
    }
    for (let i = 0; i < want.length; i++) {
      for (const f of [
        'count',
        'fwd',
        'rev',
        'probabilityTotal',
        'color',
        'name',
      ] as const) {
        if (want[i]![f] !== got[i]![f]) {
          fail(
            `position ${position} entry ${i} ${f}: ${want[i]![f]} vs ${got[i]![f]}`,
          )
          return
        }
      }
    }
  }
}

const FIXTURES = [
  { name: 'meth-100kb-40x', width: 100_000, depth: 40 },
  { name: 'meth-20kb-200x', width: 20_000, depth: 200 },
]

for (const fx of FIXTURES) {
  if (ONLY && !fx.name.includes(ONLY)) {
    continue
  }
  const regionStart = 1_000_000
  const rand = rng(31337)
  const modifications: ModificationEntry[] = []
  // A call per cytosine (~21% of a mammalian genome per strand) per read
  // covering it, methylated ~70% of the time — the shape of a methylation
  // pileup rather than of a sparse modBAM.
  for (let i = 0; i < fx.width; i++) {
    if (rand() < 0.21) {
      const position = regionStart + i
      for (let d = 0; d < fx.depth; d++) {
        const meth = rand() < 0.7
        modifications.push({
          readIndex: d,
          position,
          base: 'C',
          modType: 'm',
          strand: rand() < 0.5 ? 1 : -1,
          color: meth ? ABGR_5MC : ABGR_UNMOD,
          prob: 0.5 + rand() * 0.5,
          noMod: !meth,
        })
      }
    }
  }

  // Warm every arm the same way before any timing, and check the two shapes
  // agree entry for entry.
  const record = buildRecord(modifications, regionStart)
  const index = buildModTooltipIndex({ modifications, regionStart })
  buildControl(modifications, regionStart)
  checkIdentity(fx.name, record, index)
  const positions = [...index!.modTooltipPositions]

  const best: Record<string, number> = {
    'build-record': Infinity,
    'build-flat': Infinity,
    'build-control': Infinity,
    'post-record': Infinity,
    'post-flat': Infinity,
    'hover-flat': Infinity,
  }
  for (let r = 0; r < ROUNDS; r++) {
    gc?.()
    for (let k = 0; k < 3; k++) {
      const which = (r + k) % 3
      const t = performance.now()
      if (which === 0) {
        buildRecord(modifications, regionStart)
      } else if (which === 1) {
        buildModTooltipIndex({ modifications, regionStart })
      } else {
        buildControl(modifications, regionStart)
      }
      const ms = performance.now() - t
      const label =
        which === 0
          ? 'build-record'
          : which === 1
            ? 'build-flat'
            : 'build-control'
      best[label] = Math.min(best[label]!, ms)
    }

    gc?.()
    let t = performance.now()
    structuredClone(record)
    best['post-record'] = Math.min(best['post-record']!, performance.now() - t)
    t = performance.now()
    structuredClone(index)
    best['post-flat'] = Math.min(best['post-flat']!, performance.now() - t)

    // 200 hovers, which is a second or two of mouse movement over the band.
    t = performance.now()
    for (let h = 0; h < 200; h++) {
      modTooltipEntriesAt(index!, positions[(h * 7919) % positions.length]!)
    }
    best['hover-flat'] = Math.min(best['hover-flat']!, performance.now() - t)
  }

  console.log(
    `\n${fx.name}: ${modifications.length} calls over ${positions.length} positions`,
  )
  const row = (label: string, baseline: string) => {
    console.log(
      `  ${label.padEnd(14)} ${best[label]!.toFixed(2).padStart(8)} ms  ${(best[baseline]! / best[label]!).toFixed(2)}x`,
    )
  }
  row('build-record', 'build-record')
  row('build-flat', 'build-record')
  row('build-control', 'build-record')
  row('post-record', 'post-record')
  row('post-flat', 'post-record')
  console.log(
    `  ${'hover-flat'.padEnd(14)} ${best['hover-flat']!.toFixed(3).padStart(8)} ms  (200 hovers)`,
  )
}
