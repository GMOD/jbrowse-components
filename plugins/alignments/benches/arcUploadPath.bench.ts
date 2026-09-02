// What does one tick of an arc-band slider cost the upload tier?
//
//   npx esbuild plugins/alignments/benches/arcUploadPath.bench.ts --bundle \
//     --platform=node --format=esm --outfile=/tmp/arcUploadPath.mjs
//   node /tmp/arcUploadPath.mjs --rounds=60
//
// Flags: --rounds=<n> (default 60), --reads=<n> (default 30000)
//
// The bundle step is not optional: this bench reaches the real renderer, which
// imports `@jbrowse/render-core`, and node's strip-only TypeScript loader
// rejects a parameter property in that package. Every other bench here stays
// inside `src/` and runs under `node --experimental-strip-types` directly.
//
// THE QUESTION. `GpuAlignmentsRenderer.syncRegion` memoizes per region, and the
// memo used to have one narrow path: a recolor. An arc-only change — a
// `minInterchromSupport` drag, `drawInter`, `arcColorByType`,
// `readConnectionsLineWidth` — allocates a fresh `arcsByGroup` over the
// identical laid-out pileup, missed that path, and fell to the rebuild branch,
// which wipes the region and repacks all thirteen pileup passes and five
// coverage passes to get four arc buffers rewritten. This measures the two
// against each other on the same gesture.
//
// THE ARMS, round-robin in one process, min across rounds:
//
//   rebuild  the old behavior: a fresh `readYs` identity over identical
//            contents, which is what an arc-only change used to look like to
//            the memo — deleteRegion, then all 22 passes.
//   narrow   the new behavior: same `readYs`, new arcs object — four passes.
//   control  the same code as `rebuild`, written out a second time on purpose.
//            A run whose control is far from 1.00 measured nothing
//            (agent-docs/reference/BENCHMARKING.md).
//
// WHAT IT MEASURES. Pack plus HAL dispatch, against `MockHal` — which copies
// each uploaded buffer, as a real HAL's staging write does. Not included: the
// GPU-side allocation both HALs then do, so the rebuild arm's true cost is
// higher than this and the narrow path's saving larger.
//
// WHAT IT SAYS. --rounds=80 on an M-series laptop on AC, min ms per upload():
//
//                     10k reads   30k reads
//   rebuild             6.78 ms    71-95 ms
//   narrow              0.16 ms      0.20 ms
//   control            [0.99]       [1.07]
//
// So the whole cost of an arc-band slider tick is the arc pack either way, and
// what the narrow path drops is 6.8 ms per tick at a typical short-read window
// and 70 ms-plus at a deep one — per REGION, and a drag emits one of these per
// frame. The absolute rebuild number drifts ~30% between runs at 30k (the pack
// allocates ~10 MB a round there); the ratio and the control do not.

import { MockHal } from '@jbrowse/render-core/hal'

import {
  ALIGNMENTS_PASSES,
  GpuAlignmentsRenderer,
} from '../src/LinearAlignmentsDisplay/renderers/GpuAlignmentsRenderer.ts'
import { makePileupDataResult } from '../src/RenderAlignmentDataRPC/testPileupData.ts'
import { ARC_SHAPE_ARC } from '../src/features/arcs/shapes.ts'
import { emptyArcsUploadData } from '../src/features/arcs/types.ts'

import type { AlignmentsSources } from '../src/LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { PileupDataResult } from '../src/RenderAlignmentDataRPC/types.ts'
import type { ArcsUploadData } from '../src/features/arcs/types.ts'

const arg = (name: string, dflt: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? dflt

const ROUNDS = Number(arg('rounds', '60'))
const READS = Number(arg('reads', '30000'))
const START = 10_000
const REGION_BP = 20_000
const READ_LEN = 150

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// A deep short-read window: one segment per read, mismatches at ~0.5% of bases,
// and gaps and interbase marks at the rates a 30x-plus pileup carries. The
// per-base arrays stay empty, which is what they are at any zoom where an arc
// band is worth drawing.
function deepPileup() {
  const r = rng(7)
  const n = READS
  const mismatches = n * 5
  const gaps = Math.floor(n / 2)
  const interbase = Math.floor(n / 2)
  const readPositions = new Uint32Array(n * 2)
  const segmentPositions = new Uint32Array(n * 2)
  const segmentReadIndices = new Uint32Array(n)
  const readYs = new Uint16Array(n)
  for (let i = 0; i < n; i++) {
    const start = START + Math.floor(r() * (REGION_BP - READ_LEN))
    readPositions[i * 2] = start
    readPositions[i * 2 + 1] = start + READ_LEN
    segmentPositions[i * 2] = start
    segmentPositions[i * 2 + 1] = start + READ_LEN
    segmentReadIndices[i] = i
    readYs[i] = i % 400
  }
  const pos = (count: number) => {
    const out = new Uint32Array(count)
    for (let i = 0; i < count; i++) {
      out[i] = START + Math.floor(r() * REGION_BP)
    }
    return out
  }
  const rows = (count: number) => {
    const out = new Uint16Array(count)
    for (let i = 0; i < count; i++) {
      out[i] = Math.floor(r() * 400)
    }
    return out
  }
  return makePileupDataResult({
    readPositions,
    segmentPositions,
    segmentReadIndices,
    segmentEdgeFlags: new Uint8Array(n),
    numSegments: n,
    readYs,
    readTagColors: new Uint32Array(n),
    readColorCategories: new Uint8Array(n),

    mismatchPositions: pos(mismatches),
    mismatchYs: rows(mismatches),
    mismatchBases: new Uint8Array(mismatches).fill(1),
    mismatchFrequencies: new Uint8Array(mismatches).fill(255),
    mismatchQuals: new Uint8Array(mismatches).fill(40),

    gapPositions: (() => {
      const p = new Uint32Array(gaps * 2)
      for (let i = 0; i < gaps; i++) {
        const s = START + Math.floor(r() * (REGION_BP - 100))
        p[i * 2] = s
        p[i * 2 + 1] = s + 40
      }
      return p
    })(),
    gapYs: rows(gaps),
    gapTypes: new Uint8Array(gaps),
    gapFrequencies: new Uint8Array(gaps).fill(255),

    interbasePositions: pos(interbase),
    interbaseYs: rows(interbase),
    interbaseLengths: new Uint32Array(interbase).fill(5),
    interbaseTypes: new Uint8Array(interbase),
    interbaseFrequencies: new Uint8Array(interbase).fill(255),
    numInsertions: interbase,

    coverageGpuBinCount: REGION_BP,
    coveragePackedBuffer: new ArrayBuffer(REGION_BP * 16),
    snpPackedBuffer: new ArrayBuffer(REGION_BP * 16),
  })
}

// A band's worth of arcs, ~1% of the reads — the feed a slider tick rebuilds.
function arcFeed(seed: number): ArcsUploadData {
  const r = rng(seed)
  const n = Math.max(1, Math.floor(READS / 100))
  const x1 = new Uint32Array(n)
  const x2 = new Uint32Array(n)
  const yBp = new Uint32Array(n)
  const spanBp = new Uint32Array(n)
  const support = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    const s = START + Math.floor(r() * (REGION_BP - 500))
    x1[i] = s
    x2[i] = s + 400
    yBp[i] = 400
    spanBp[i] = 400
    support[i] = 1 + Math.floor(r() * 8)
  }
  return {
    ...emptyArcsUploadData(),
    arcX1: x1,
    arcX2: x2,
    arcColorTypes: new Uint8Array(n),
    arcShapeTypes: new Uint8Array(n).fill(ARC_SHAPE_ARC),
    arcYBp: yBp,
    arcSpanBp: spanBp,
    arcSupport: support,
    numArcs: n,
  }
}

function sources(
  data: PileupDataResult,
  arcs: ArcsUploadData,
): AlignmentsSources {
  return {
    sections: [
      {
        groupKey: '',
        laidOutPileupMap: new Map([[0, data]]),
        arcsRpcDataMap: new Map([[0, arcs]]),
      },
    ],
    densityRegions: new Map(),
    readConnectionsLineWidth: 1,
  }
}

// A pileup whose contents are the same and whose `readYs` is a new object, which
// is what an arc-only change looked like to the memo before the narrow path.
function relaidOut(data: PileupDataResult): PileupDataResult {
  return { ...data, readYs: data.readYs.slice() }
}

const DATA = deepPileup()
const FEEDS = Array.from({ length: ROUNDS + 2 }, (_, i) => arcFeed(100 + i))

// Three drivers, written out longhand. Sharing one would put every arm through
// the same polymorphic call site — see BENCHMARKING.md.
const runRebuild = (
  renderer: GpuAlignmentsRenderer,
  hal: MockHal,
  round: number,
) => {
  hal.calls = []
  renderer.upload('sources', sources(relaidOut(DATA), FEEDS[round]!))
}

const runNarrow = (
  renderer: GpuAlignmentsRenderer,
  hal: MockHal,
  round: number,
) => {
  hal.calls = []
  renderer.upload('sources', sources(DATA, FEEDS[round]!))
}

const runControl = (
  renderer: GpuAlignmentsRenderer,
  hal: MockHal,
  round: number,
) => {
  hal.calls = []
  renderer.upload('sources', sources(relaidOut(DATA), FEEDS[round]!))
}

function arm(run: typeof runRebuild) {
  const hal = new MockHal(ALIGNMENTS_PASSES)
  const renderer = new GpuAlignmentsRenderer(hal)
  renderer.upload('sources', sources(DATA, FEEDS[0]!))
  return {
    hal,
    renderer,
    best: Number.POSITIVE_INFINITY,
    uploads: 0,
    run,
  }
}

const arms = {
  rebuild: arm(runRebuild),
  narrow: arm(runNarrow),
  control: arm(runControl),
}

// Rotated as well as interleaved: an arm uploading megabytes per round leaves
// the arm after it holding the collection, so a fixed order is a fixed tax on
// whoever runs last. Each arm takes each position over the run and the min is
// its best uncontended sample.
const order = Object.values(arms)

// Each wide round packs and copies megabytes, so a collection lands inside
// somebody's timed section otherwise — which is what the control arm reports
// when it does.
const collect = () => {
  const gc = (globalThis as { gc?: () => void }).gc
  if (gc) {
    gc()
  }
}

for (let round = 1; round <= ROUNDS; round++) {
  for (let i = 0; i < order.length; i++) {
    const a = order[(round + i) % order.length]!
    collect()
    const t0 = performance.now()
    a.run(a.renderer, a.hal, round)
    a.best = Math.min(a.best, performance.now() - t0)
    a.uploads = a.hal.callsOf('uploadBuffer').length
  }
}

console.log(
  `${READS} reads / ${DATA.numSegments} segments, ${ROUNDS} rounds, min ms per upload()`,
)
for (const [name, a] of Object.entries(arms)) {
  console.log(
    `  ${name.padEnd(8)} ${a.best.toFixed(3)} ms  (${a.uploads} passes uploaded)`,
  )
}
console.log(
  `  ratio    ${(arms.rebuild.best / arms.narrow.best).toFixed(2)}x, control ${(
    arms.control.best / arms.rebuild.best
  ).toFixed(2)}x`,
)
