// A/B the three per-row MAF overlay walks — insertions, deletions, inversions —
// in the working tree against the same functions from another git ref, over a
// synthetic region panned across.
//
//   node --expose-gc plugins/maf/benches/mafOverlays.bench.ts
//   node --expose-gc plugins/maf/benches/mafOverlays.bench.ts --base=HEAD~1
//
// Flags: --base=<ref> (default main), --rounds=<n> (default 12), --allow-diff
//
// The harness rules — interleave, report the MIN, run a control, check identity
// first — are `agent-docs/reference/BENCHMARKING.md`, and this follows
// `mafCoverage.bench.ts` rather than reinventing them. Read that file before
// writing another bench.
//
// WHAT IS DIFFERENT HERE, AND WHY THERE ARE TWO TIMES PER ROW.
//
// These three overlays are not one-shot computations like coverage: they run on
// every frame of a pan, over region data that does not change while the user
// pans. So the question is not "how fast is one call" but "how fast is the
// SECOND call over the same data", and an implementation that pays up front to
// make later frames cheap has to be judged on both. Hence:
//
//   first    one call against a region object the caches have not seen. For the
//            working tree this includes building the event index; for the
//            baseline it is just a normal call, so the baseline's two numbers
//            are proportional and that is the honest picture.
//   pan      a whole sweep across every pan position, against a region object
//            already in hand — the steady state, which is every frame after the
//            first. A sweep rather than one frame so that a round is a repeat
//            of the SAME work: picking the frame by round index made `min`
//            across rounds a min across twelve different workloads.
//
// A ratio under 1.00 in the `first` column and far over it in `pan` is the
// trade being made, not a bug. Quoting only the second would be a story.
//
// The region object identity is what the caches key on (`mafRowEvents.ts`), so
// `first` is measured by re-wrapping the same blocks in a fresh object rather
// than regenerating megabytes of synthetic alignment per timing.
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { checkoutPackageAtRef } from './refCheckout.ts'

const root = join(import.meta.dirname, '..', '..', '..')

const COMPONENTS = 'plugins/maf/src/LinearMafDisplay/components'

interface Marker {
  rowTop: number
  h: number
  [k: string]: number
}

type OverlayFn = (params: never) => Marker[]
type ConsensusFn = (map: never) => never

interface Arm {
  insertions: OverlayFn
  deletions: OverlayFn
  inversions: OverlayFn
  consensus: ConsensusFn
}

function named(mod: object, name: string, label: string) {
  const fn = (mod as Record<string, unknown>)[name]
  if (typeof fn !== 'function') {
    throw new Error(`${label} has no ${name} export`)
  }
  return fn as OverlayFn
}

async function loadFrom(dir: string, label: string): Promise<Arm> {
  const inversionsMod = await import(
    join(dir, COMPONENTS, 'computeVisibleInversions.ts')
  )
  return {
    insertions: named(
      await import(join(dir, COMPONENTS, 'computeVisibleInsertions.ts')),
      'computeVisibleInsertions',
      label,
    ),
    deletions: named(
      await import(join(dir, COMPONENTS, 'computeVisibleDeletions.ts')),
      'computeVisibleDeletions',
      label,
    ),
    inversions: named(inversionsMod, 'computeVisibleInversions', label),
    consensus: named(
      inversionsMod,
      'consensusStrandByRowChr',
      label,
    ) as unknown as ConsensusFn,
  }
}

// Whole-package checkout, importable — see `checkoutPackageAtRef` for both
// halves of why. It matters more here than for coverage: the baseline's
// `forEachInsertion` and `rowFlank` must be its own.
async function loadRef(baseRef: string, label: string) {
  const dir = checkoutPackageAtRef(root, baseRef)
  return { arm: await loadFrom(dir, label), dir }
}

// --- synthetic placed region ----------------------------------------------

const BASES = 'ACGT'
const enc = new TextEncoder()

interface Shape {
  name: string
  rows: number
  cols: number
  blocks: number
  /** every Nth reference column is a gap — this is what makes an insertion */
  refGapEvery: number
  /** a deletion run starts every Nth column of a row... */
  rowGapEvery: number
  /** ...and is this many reference columns long */
  rowGapRun: number
  /** every Nth (block, row) aligns against the row's own consensus strand */
  invertedEvery: number
  /** bp the viewport shows; the region is panned across in `frames` steps */
  visibleBp: number
}

interface Row {
  rowIndex: number
  alignmentBytes: Uint8Array
  chr: string
  strand: number
}

interface Block {
  startBp: number
  endBp: number
  refSeqBytes: Uint8Array
  rows: Row[]
  empties: never[]
}

// The three events are each a specific *disagreement* between a row and the
// reference, and a generator that copies the reference into its rows produces
// none of them — the first version of this file did exactly that and reported
// "0 markers" on every shape while still timing the walks, which is a bench
// measuring the empty case and calling it the full one.
//
//   insertion — the reference column is a gap and the ROW carries a base
//   deletion  — the reference column is a base and the ROW carries a gap, in a
//               run long enough to have a width worth testing
//   inversion — the row's strand differs from the consensus of its own (row,
//               chr) pair, so a *minority* of a row's blocks must be flipped
//               rather than all of them
function makeBlocks(s: Shape) {
  const blocks: Block[] = []
  let bp = 0
  for (let b = 0; b < s.blocks; b++) {
    let ref = ''
    for (let i = 0; i < s.cols; i++) {
      ref += (b + i) % s.refGapEvery === 0 ? '-' : BASES[(b + i) % 4]!
    }
    const rows: Row[] = []
    for (let r = 0; r < s.rows; r++) {
      let row = ''
      for (let i = 0; i < s.cols; i++) {
        row +=
          ref[i] === '-'
            ? BASES[(i + r) % 4]! // an inserted base, under a reference gap
            : (i + r) % s.rowGapEvery < s.rowGapRun
              ? '-' // a deleted reference base
              : ref[i]!
      }
      rows.push({
        rowIndex: r,
        alignmentBytes: enc.encode(row),
        chr: `chr${r}`,
        strand: (b + r) % s.invertedEvery === 0 ? -1 : 1,
      })
    }
    const refLen = ref.replaceAll('-', '').length
    blocks.push({
      startBp: bp,
      endBp: bp + refLen,
      refSeqBytes: enc.encode(ref),
      rows,
      empties: [],
    })
    bp += refLen
  }
  return { blocks, regionEnd: bp }
}

const CANVAS_PX = 1500

function makeFrames(s: Shape, regionEnd: number, frames: number) {
  const bpPerPx = s.visibleBp / CANVAS_PX
  const span = Math.max(1, regionEnd - s.visibleBp)
  return Array.from({ length: frames }, (_, i) => {
    const start = Math.floor((span * i) / frames)
    return {
      visibleRegions: [
        {
          displayedRegionIndex: 0,
          start,
          end: start + s.visibleBp,
          screenStartPx: 0,
          reversed: false,
        },
      ],
      bpPerPx,
    }
  })
}

// --- identity -------------------------------------------------------------

// As a multiset, not element by element: the overlays are free to emit markers
// in a different order, since every marker carries its own position and rows
// occupy disjoint bands, so two arrays holding the same markers paint the same
// pixels. What the comparison must not do is get looser than that — a dropped
// marker, a shifted `xCenter`, a wrong `length` all still fail.
function keyOf(marker: Marker) {
  return Object.keys(marker)
    .sort()
    .map(k => `${k}=${marker[k]!}`)
    .join(' ')
}

function firstDifference(a: Marker[], b: Marker[]) {
  if (a.length !== b.length) {
    return `marker count ${a.length} vs ${b.length}`
  }
  const counts = new Map<string, number>()
  for (const marker of a) {
    const key = keyOf(marker)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  for (const marker of b) {
    const key = keyOf(marker)
    const n = counts.get(key)
    if (n === undefined) {
      return `only the second side has {${key}}`
    }
    counts.set(key, n - 1)
    if (n === 1) {
      counts.delete(key)
    }
  }
  const [leftover] = counts.keys()
  return leftover === undefined
    ? undefined
    : `only the first side has {${leftover}}`
}

// --- shapes ---------------------------------------------------------------

// Sized to regions the byte gate actually admits, which is what bounds the
// index this change adds. `LinearMafDisplay`'s `fetchSizeLimit` is 5 Mb, and
// MAF_LARGE_BLOCKS.md measures a 40 kb buffered window at 5.3 MB uncompressed
// for *100* rows — so a 26-way gets a few hundred kb of buffered region and a
// 447-way gets tens of kb. A shape past that is one the gate stops.
const SHAPES: Shape[] = [
  // The shape MAF_LARGE_BLOCKS.md's insertion/deletion numbers were taken over:
  // the UCSC ce11 26-way is tens of thousands of tiny blocks, and the buffered
  // region is about twice what is on screen.
  {
    name: 'ce11 26-way, 7bp blocks, 180kb visible',
    rows: 26,
    cols: 7,
    blocks: 54_000,
    refGapEvery: 29,
    rowGapEvery: 11,
    rowGapRun: 2,
    invertedEvery: 97,
    visibleBp: 180_000,
  },
  // Zoomed in on the same data: only a few blocks are in view, so the per-frame
  // walk was already cheap and the index build is pure overhead. This row is
  // here to show what the trade costs where it does not pay.
  {
    name: 'ce11 26-way, 7bp blocks, 2kb visible',
    rows: 26,
    cols: 7,
    blocks: 54_000,
    refGapEvery: 29,
    rowGapEvery: 11,
    rowGapRun: 2,
    invertedEvery: 97,
    visibleBp: 2_000,
  },
  // Few large blocks: the shape a hal2maf export without chunking produces, and
  // the one where a block-level bp cull buys nothing because a block is wider
  // than the screen.
  {
    name: '30-way, 20kb blocks, 180kb visible',
    rows: 30,
    cols: 20_000,
    blocks: 40,
    refGapEvery: 29,
    rowGapEvery: 400,
    rowGapRun: 60,
    invertedEvery: 97,
    visibleBp: 180_000,
  },
  // The one shape whose deletions actually LABEL, and it takes both knobs to
  // get there. A label needs the run to clear the narrowest digit — 7.5px, so
  // ~906bp at 120bp/px — and `forEachDeletion` ends a run at any *reference*
  // gap, so a run is capped by `refGapEvery` however long `rowGapRun` is. Every
  // other shape here has a reference gap every ~30 columns and therefore no run
  // over 30bp: they measure the culled path, where the deletion overlay emits
  // nothing and the walk is the whole cost. Without this row the bench reports
  // "0 markers" everywhere while still timing, which is a bench measuring the
  // empty case and quoting it as the full one.
  {
    name: '30-way, 20kb blocks, sparse ref gaps, 180kb visible',
    rows: 30,
    cols: 20_000,
    blocks: 40,
    refGapEvery: 3_000,
    rowGapEvery: 4_000,
    rowGapRun: 1_200,
    invertedEvery: 97,
    visibleBp: 180_000,
  },
  // A deep alignment over the span its own byte gate leaves it: 447 rows over
  // 40kb, not the 180kb the shallower shapes get.
  {
    name: '447-way, 200bp blocks, 20kb visible',
    rows: 447,
    cols: 200,
    blocks: 200,
    refGapEvery: 31,
    rowGapEvery: 11,
    rowGapRun: 2,
    invertedEvery: 97,
    visibleBp: 20_000,
  },
]

// --- run ------------------------------------------------------------------

const baseRef =
  process.argv.find(a => a.startsWith('--base='))?.slice('--base='.length) ??
  'main'
const rounds = Number(
  process.argv
    .find(a => a.startsWith('--rounds='))
    ?.slice('--rounds='.length) ?? 12,
)

// Pan positions per sweep, deliberately NOT `rounds`. They were the same number
// and the frame was picked by round index, which made every round a *different*
// workload — so the min across rounds was the cheapest pan position rather than
// the least-contended sample of one, and `--rounds` changed what was measured
// instead of how well. A round is now a whole sweep across all of these.
const FRAMES = 12

const current = await loadFrom(root, 'working tree')
const base = await loadRef(baseRef, baseRef)
const control = await loadRef(baseRef, `${baseRef} (control)`)

console.log(
  `working tree vs ${baseRef}, min of ${rounds} interleaved rounds\n` +
    `control is ${baseRef} loaded a second time: its ratio is the noise floor,\n` +
    `and a row whose control is not near 1.00 did not measure anything\n` +
    `first = one call on a region the caches have not seen\n` +
    `pan   = a whole ${FRAMES}-position sweep of a region already in hand\n`,
)

const GEOMETRY = { rowHeight: 20, rowProportion: 0.8, scrollTop: 0 }

let failed = false
try {
  for (const shape of SHAPES) {
    const { blocks, regionEnd } = makeBlocks(shape)
    const coverage = {}
    const frames = makeFrames(shape, regionEnd, FRAMES)
    const viewportHeight = shape.rows * GEOMETRY.rowHeight
    // Built from the same blocks each side sees, and by each side's own
    // `consensusStrandByRowChr`, so no arm inherits another's Map.
    const consensusFor = (arm: Arm) =>
      arm.consensus(new Map([[0, { blocks, coverage }]]) as never)

    const kinds = [
      ['insertions', (a: Arm) => a.insertions],
      ['deletions', (a: Arm) => a.deletions],
      ['inversions', (a: Arm) => a.inversions],
    ] as const

    console.log(
      `${shape.name}\n  ${shape.blocks.toLocaleString()} blocks x ${shape.rows} rows, ` +
        `${(regionEnd / 1000).toFixed(0)}kb region, ${(shape.visibleBp / 1000).toFixed(0)}kb visible`,
    )

    for (const [kind, pick] of kinds) {
      const consensus = {
        baseline: consensusFor(base.arm),
        control: consensusFor(control.arm),
        current: consensusFor(current),
      }
      // `rpcDataMap` is read structurally by `eachVisibleRegion`, so a plain
      // Map is enough — and a fresh wrapper object is what makes a call count
      // as `first`.
      const wrap = (fresh: boolean, held: object) =>
        new Map([[0, fresh ? { blocks, coverage } : held]])
      const held = { blocks, coverage }
      const run = (
        arm: Arm,
        side: keyof typeof consensus,
        frame: number,
        fresh: boolean,
      ) =>
        pick(arm)({
          view: frames[frame],
          rpcDataMap: wrap(fresh, held),
          ...GEOMETRY,
          viewportHeight,
          consensus: consensus[side],
        } as never)

      // Warm and identity-check every arm the same way — an arm left cold or
      // unchecked while its neighbours are not is the asymmetric-warmup trap.
      // Every pan position, cold and warm, rather than one frame warm: a cache
      // that answers the first frame and then goes stale is exactly the failure
      // this change could introduce, and it is invisible at one position.
      let diff: string | undefined
      let markerCount = 0
      for (let frame = 0; frame < FRAMES; frame++) {
        for (const fresh of [true, false]) {
          const out = {
            baseline: run(base.arm, 'baseline', frame, fresh),
            control: run(control.arm, 'control', frame, fresh),
            current: run(current, 'current', frame, fresh),
          }
          markerCount = Math.max(markerCount, out.baseline.length)
          diff ??=
            firstDifference(out.baseline, out.current) ??
            firstDifference(out.baseline, out.control)
        }
      }
      if (diff) {
        failed = true
      }

      const sides = [
        ['baseline', base.arm],
        ['control', control.arm],
        ['current', current],
      ] as const
      const best = {
        first: { baseline: Infinity, control: Infinity, current: Infinity },
        pan: { baseline: Infinity, control: Infinity, current: Infinity },
      }
      for (let round = 0; round < rounds; round++) {
        for (const [side, arm] of sides) {
          globalThis.gc?.()
          const tFirst = performance.now()
          run(arm, side, 0, true)
          best.first[side] = Math.min(
            best.first[side],
            performance.now() - tFirst,
          )
          globalThis.gc?.()
          const tPan = performance.now()
          for (let frame = 0; frame < FRAMES; frame++) {
            run(arm, side, frame, false)
          }
          best.pan[side] = Math.min(best.pan[side], performance.now() - tPan)
        }
      }
      const row = (phase: 'first' | 'pan') =>
        `${phase.padEnd(6)}${best[phase].baseline.toFixed(2).padStart(9)} ms  ` +
        `control ${(best[phase].baseline / best[phase].control).toFixed(3)}x  ` +
        `working tree ${best[phase].current.toFixed(2).padStart(9)} ms  ` +
        `${(best[phase].baseline / best[phase].current).toFixed(3)}x`
      console.log(
        `  ${kind} — up to ${markerCount.toLocaleString()} markers a frame, ` +
          `output ${diff ? `DIFFERS — ${diff}` : 'identical'}\n` +
          `    ${row('first')}\n` +
          `    ${row('pan')}`,
      )
    }
    console.log()
  }
} finally {
  rmSync(base.dir, { recursive: true, force: true })
  rmSync(control.dir, { recursive: true, force: true })
}

if (failed && !process.argv.includes('--allow-diff')) {
  console.error(
    'The two sides report different markers. If that is deliberate — the\n' +
      'change above is one you meant to make — rerun with --allow-diff.\n' +
      'Otherwise the timings are comparing two different computations.',
  )
  process.exitCode = 1
}
